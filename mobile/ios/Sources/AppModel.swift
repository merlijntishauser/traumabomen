import Foundation
import TraumabomenCore

/// The app's state machine: login -> unlock (passphrase or Face ID) ->
/// journal. Owns the API client and, after unlock, the in-memory master
/// key. Locking drops the key. Key custody follows the design: after a
/// passphrase unlock the key is wrapped by the Secure Enclave; Face ID
/// carries daily use; the passphrase returns after 7 days or whenever the
/// wrap is invalidated.
@MainActor
final class AppModel: ObservableObject {
    enum Phase {
        case welcome
        case login
        case biometric
        case treeList
        case unlock(hint: String?)
        case working(String)
        case journal(entries: [Entry])
    }

    struct Entry: Identifiable {
        let id: String
        let title: String
        let content: String
        var pending: Bool = false
    }

    enum Tab { case journal, tree }

    @Published var phase: Phase
    @Published var errorMessage: String?
    @Published var activeTab: Tab = .journal
    @Published var themeMode: ThemeMode = ThemeMode.current {
        didSet { ThemeMode.current = themeMode }
    }
    @Published var trees: [TreeChoice] = []
    @Published var selectedTreeId: String?

    struct TreeChoice: Identifiable, Equatable {
        let id: String
        let name: String
        var personCount: Int = 0
        var momentCount: Int = 0
        var journalCount: Int = 0
    }

    private var treeKeys: [String: AesGcmKey] = [:]
    @Published var treeData: TreeData?

    private let api: ApiClient
    private let sync: TreeSync
    private let cache: SessionCache
    private var saltBase64: String?
    private var masterKey: AesGcmKey?
    private var treeId: String?
    private var treeKey: AesGcmKey?

    init() {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-custodyRelaxed") {
            KeyCustody.relaxedForSimulatorTesting = true
        }
        #endif
        let base = Self.launchArgument("-apiBase") ?? "http://localhost:8000"
        let tokens = KeychainTokenStore()
        api = PlatformHttpKt.createApiClient(baseUrl: base, tokens: tokens)
        let db = CoreDb_iosKt.openCoreDatabase(name: "traumabomen-core.db")
        sync = TreeSync(db: db, api: api)
        cache = SessionCache(db: db)
        // A stored session plus a fresh Enclave wrap means Face ID can open
        // the app without a passphrase; otherwise start at login.
        if !WelcomeView.hasBeenSeen {
            phase = .welcome
        } else {
            phase = (tokens.refreshToken != nil && KeyCustody.hasFreshKey()) ? .biometric : .login
        }
    }

    func dismissWelcome() {
        phase = (KeychainTokenStore().refreshToken != nil && KeyCustody.hasFreshKey()) ? .biometric : .login
    }

    func login(email: String, password: String) async {
        errorMessage = nil
        phase = .working("Logging in")
        do {
            let salt = try await api.login(email: email, password: password)
            saltBase64 = salt.encryptionSalt
            cache.saltBase64 = salt.encryptionSalt
            cache.passphraseHint = salt.passphraseHint
            phase = .unlock(hint: salt.passphraseHint)
        } catch {
            errorMessage = "Login failed. Check your email and password."
            phase = .login
        }
    }

    func unlock(passphrase: String) async {
        guard let salt = saltBase64 else { return }
        let hint = currentHint
        errorMessage = nil
        phase = .working("Unlocking")

        let rawKey = await Self.deriveKeyBytes(passphrase: passphrase, salt: salt)
        let master = TraumaCrypto.shared.keyFromBytes(rawKey: rawKey)
        do {
            try await decryptRing(with: master)
            // Only a verified key (the ring decrypted) enters custody.
            if KeyCustody.isAvailable {
                try? KeyCustody.store(masterKey: rawKey.toData())
            }
            masterKey = master
            await presentAfterUnlock()
        } catch {
            errorMessage = "Incorrect passphrase."
            phase = .unlock(hint: hint)
        }
    }

    /// Face ID path: the Enclave releases the wrapped key, no derivation.
    func biometricUnlock() async {
        errorMessage = nil
        guard let rawKey = KeyCustody.retrieve(reason: "Unlock your Traumatrees data") else {
            // Cancelled, stale, or invalidated: fall back to the passphrase.
            await usePassphraseInstead()
            return
        }
        phase = .working("Unlocking")
        let master = TraumaCrypto.shared.keyFromBytes(rawKey: KotlinByteArray.from(rawKey))
        do {
            try await decryptRing(with: master)
            masterKey = master
            await presentAfterUnlock()
        } catch {
            // Session expired beyond refresh; a fresh login re-establishes it.
            KeychainTokenStore.clear()
            phase = .login
        }
    }

    enum UnlockError: Error {
        case noKeyRing
    }

    /// While a session exists, the salt is fetchable (or served from the
    /// offline cache) and the passphrase path works without credentials.
    func usePassphraseInstead() async {
        if let salt = try? await api.fetchSalt() {
            saltBase64 = salt.encryptionSalt
            cache.saltBase64 = salt.encryptionSalt
            cache.passphraseHint = salt.passphraseHint
            phase = .unlock(hint: salt.passphraseHint)
        } else if let cached = cache.saltBase64 {
            saltBase64 = cached
            phase = .unlock(hint: cache.passphraseHint)
        } else {
            KeychainTokenStore.clear()
            phase = .login
        }
    }

    /// Lock only when something is unlocked (the background grace timer).
    func lockIfUnlocked() {
        switch phase {
        case .journal, .treeList: lock()
        default: break
        }
    }

    /// Drop the key; Face ID (if custody is fresh) or passphrase reopens.
    func lock() {
        masterKey = nil
        treeKey = nil
        treeKeys = [:]
        treeData = nil
        trees = []
        phase = KeyCustody.hasFreshKey() ? .biometric : .unlock(hint: currentHint)
    }

    /// Decrypt the key ring (verifying the key) and build the tree list.
    private func decryptRing(with master: AesGcmKey) async throws {
        // Fresh ring when the network allows; the cached copy opens the app
        // offline. Both are ciphertext only the right key can use.
        let ringBlob: String
        if let fetched = try? await api.fetchKeyRing() {
            cache.encryptedKeyRing = fetched
            ringBlob = fetched
        } else if let cached = cache.encryptedKeyRing {
            ringBlob = cached
        } else {
            throw UnlockError.noKeyRing
        }
        // A wrong key fails right here, on authenticated decryption.
        let ring = try TraumaCrypto.shared.decryptKeyRing(
            encryptedKeyRing: ringBlob, masterKey: master
        )
        treeKeys = ring.reduce(into: [:]) { dict, pair in
            dict[pair.key] = TraumaCrypto.shared.importTreeKey(base64Key: pair.value)
        }
        await buildTreeList(ring: ring)
    }

    /// The tree is the app's top-level context: land on the tree list, unless
    /// there is exactly one (open it directly) or a debug tree was requested.
    private func presentAfterUnlock() async {
        if let chosen = selectedTreeId, treeKeys[chosen] != nil, trees.count == 1 {
            phase = .journal(entries: await loadTree(chosen))
        } else if let chosen = selectedTreeId, treeKeys[chosen] != nil, forcedTreeSelection {
            phase = .journal(entries: await loadTree(chosen))
        } else if trees.isEmpty {
            phase = .journal(entries: [])
        } else {
            phase = .treeList
        }
    }

    /// Open a tree from the list into its journal and canvas.
    func enterTree(_ id: String) async {
        guard treeKeys[id] != nil else { return }
        selectedTreeId = id
        cache.selectedTreeId = id
        phase = .working("Opening")
        phase = .journal(entries: await loadTree(id))
    }

    /// Return to the tree list without dropping the keys.
    func showTreeList() {
        activeTab = .journal
        treeData = nil
        phase = .treeList
    }

    /// Decrypt each tree's name (from the server list, cached for offline)
    /// and pick the selected tree: the persisted choice if still present,
    /// else the first.
    private func buildTreeList(ring: [String: String]) async {
        struct Summary { let id: String; let blob: String; let people: Int; let moments: Int; let journals: Int }
        var summaries: [Summary] = []
        if let fetched = try? await api.listTrees() {
            summaries = fetched.map {
                Summary(id: $0.id, blob: $0.encryptedData,
                        people: Int($0.personCount), moments: Int($0.momentCount), journals: Int($0.journalCount))
            }
            cache.treeList = try? JSONEncoder().encode(summaries.map {
                ["id": $0.id, "blob": $0.blob, "people": String($0.people),
                 "moments": String($0.moments), "journals": String($0.journals)]
            }).base64EncodedString()
        } else if let cached = cache.treeList,
                  let data = Data(base64Encoded: cached),
                  let rows = try? JSONDecoder().decode([[String: String]].self, from: data) {
            summaries = rows.compactMap { row in
                guard let id = row["id"], let blob = row["blob"] else { return nil }
                return Summary(id: id, blob: blob,
                               people: Int(row["people"] ?? "0") ?? 0,
                               moments: Int(row["moments"] ?? "0") ?? 0,
                               journals: Int(row["journals"] ?? "0") ?? 0)
            }
        }

        var choices: [TreeChoice] = []
        for summary in summaries {
            guard let key = treeKeys[summary.id] else { continue }
            let name = Self.decryptTreeName(summary.blob, key: key) ?? "Untitled tree"
            choices.append(TreeChoice(id: summary.id, name: name, personCount: summary.people,
                                      momentCount: summary.moments, journalCount: summary.journals))
        }
        for id in treeKeys.keys where !choices.contains(where: { $0.id == id }) {
            choices.append(TreeChoice(id: id, name: "Untitled tree"))
        }
        trees = choices.sorted { $0.name.localizedCompare($1.name) == .orderedAscending }

        forcedTreeSelection = false
        #if DEBUG
        if let want = Self.launchArgument("-selectTree"),
           let match = trees.first(where: { $0.name.localizedCaseInsensitiveContains(want) }) {
            selectedTreeId = match.id
            forcedTreeSelection = true
            return
        }
        #endif
        let persisted = cache.selectedTreeId
        selectedTreeId = (persisted.flatMap { id in trees.first { $0.id == id }?.id })
            ?? trees.first?.id
    }

    private var forcedTreeSelection = false

    /// Load one tree's journal, canvas, and stories into memory.
    private func loadTree(_ id: String) async -> [Entry] {
        cache.selectedTreeId = id
        treeId = id
        treeKey = treeKeys[id]
        _ = try? await sync.push(treeId: id)
        await refreshTree()
        return await refreshEntries()
    }

    /// Pull and decrypt the read-only tree (persons and relationships);
    /// offline, the mirror serves the last known tree.
    private func refreshTree() async {
        guard let tree = treeId, let key = treeKey else { return }
        let personRows = (try? await sync.pull(treeId: tree, type: .persons)) ?? []
        let edgeRows = (try? await sync.pull(treeId: tree, type: .relationships)) ?? []
        let persons = personRows.enumerated().compactMap { index, row in
            TreeDecoding.person(row, key: key, fallbackIndex: index)
        }
        let edges = edgeRows.compactMap { TreeDecoding.edge($0, key: key) }

        // The reflective layer attached to persons: the badge grammar.
        var stories: [String: PersonStory] = [:]
        func collect(_ type: EntityType, _ assign: (inout PersonStory, StoryItem) -> Void) async {
            let rows = (try? await sync.pull(treeId: tree, type: type)) ?? []
            for row in rows {
                guard let (personIds, item) = TreeDecoding.storyItem(row, key: key) else { continue }
                for pid in personIds {
                    assign(&stories[pid, default: PersonStory()], item)
                }
            }
        }
        await collect(.traumaEvents) { $0.trauma.append($1) }
        await collect(.lifeEvents) { $0.life.append($1) }
        await collect(.turningPoints) { $0.turning.append($1) }

        treeData = TreeData(persons: persons, edges: edges, stories: stories)
    }

    /// Pull, reconcile, and decrypt the local journal view from the mirror.
    private func refreshEntries() async -> [Entry] {
        guard let tree = treeId, let key = treeKey else { return [] }
        let rows = (try? await sync.pullJournal(treeId: tree)) ?? []
        return rows.reversed().compactMap { Self.decryptRow($0, key: key) }
    }

    var pendingSyncCount: Int {
        guard let tree = treeId else { return 0 }
        return Int(sync.pendingCount(treeId: tree))
    }

    /// Encrypt and queue a new entry, then try to push; the entry is
    /// visible immediately either way, and the queue survives restarts.
    func createEntry(title: String, content: String) async {
        guard let tree = treeId, let key = treeKey else { return }
        let payload = ["title": title, "content": content]
        guard
            let data = try? JSONEncoder().encode(payload),
            let json = String(data: data, encoding: .utf8)
        else { return }
        let encrypted = TraumaCrypto.shared.encryptJsonForApi(plaintextJson: json, key: key)
        _ = sync.createLocal(treeId: tree, encryptedData: encrypted)
        _ = try? await sync.push(treeId: tree)
        phase = .journal(entries: await refreshEntries())
    }

    private var currentHint: String? {
        if case .unlock(let hint) = phase { return hint }
        return nil
    }

    /// Argon2id costs about a second by design; never run it on the main actor.
    private nonisolated static func deriveKeyBytes(passphrase: String, salt: String) async -> KotlinByteArray {
        await Task.detached(priority: .userInitiated) {
            TraumaCrypto.shared.deriveMasterKeyBytes(passphrase: passphrase, saltBase64: salt)
        }.value
    }

    private struct EntryJson: Decodable {
        let title: String
        let content: String
    }

    private nonisolated static func decryptTreeName(_ blob: String, key: AesGcmKey) -> String? {
        struct NameJson: Decodable { let name: String }
        guard
            let plaintext = try? TraumaCrypto.shared.decryptJsonFromApi(encryptedData: blob, key: key),
            let json = try? JSONDecoder().decode(NameJson.self, from: Data(plaintext.utf8))
        else { return nil }
        return json.name
    }

    private nonisolated static func decryptRow(_ row: MirrorEntry, key: AesGcmKey) -> Entry? {
        guard
            let plaintext = try? TraumaCrypto.shared.decryptJsonFromApi(
                encryptedData: row.encryptedData, key: key
            ),
            let entry = try? JSONDecoder().decode(EntryJson.self, from: Data(plaintext.utf8))
        else { return nil }
        return Entry(id: row.id, title: entry.title, content: entry.content, pending: row.pendingSync)
    }

    static func launchArgument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: name), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    #if DEBUG
    /// Test affordance: -email/-password/-unlockPassphrase launch arguments
    /// drive the whole flow without a keyboard (dev accounts only).
    func debugAutoFlow() async {
        if ProcessInfo.processInfo.arguments.contains("-showTree") {
            activeTab = .tree
        }
        if case .biometric = phase,
           ProcessInfo.processInfo.arguments.contains("-autoBiometric") {
            await biometricUnlock()
            await debugComposeIfAsked()
            return
        }
        guard
            let email = Self.launchArgument("-email"),
            let password = Self.launchArgument("-password")
        else { return }
        await login(email: email, password: password)
        if case .unlock = phase, let passphrase = Self.launchArgument("-unlockPassphrase") {
            await unlock(passphrase: passphrase)
        }
        await debugComposeIfAsked()
    }

    var debugOpenSettings: Bool {
        ProcessInfo.processInfo.arguments.contains("-openSettings")
    }

    private func debugComposeIfAsked() async {
        if case .journal = phase, let compose = Self.launchArgument("-composeEntry") {
            let parts = compose.split(separator: "|", maxSplits: 1).map(String.init)
            await createEntry(title: parts.first ?? "", content: parts.count > 1 ? parts[1] : "")
        }
    }
    #endif
}
