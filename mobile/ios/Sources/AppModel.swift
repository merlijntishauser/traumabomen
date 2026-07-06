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
        case login
        case biometric
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

    @Published var phase: Phase
    @Published var errorMessage: String?

    private let api: ApiClient
    private let sync: JournalSync
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
        sync = JournalSync(db: db, api: api)
        cache = SessionCache(db: db)
        // A stored session plus a fresh Enclave wrap means Face ID can open
        // the app without a passphrase; otherwise start at login.
        phase = (tokens.refreshToken != nil && KeyCustody.hasFreshKey()) ? .biometric : .login
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
            let entries = try await openJournal(with: master)
            // Only a verified key (the ring decrypted) enters custody.
            if KeyCustody.isAvailable {
                try? KeyCustody.store(masterKey: rawKey.toData())
            }
            masterKey = master
            phase = .journal(entries: entries)
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
            let entries = try await openJournal(with: master)
            masterKey = master
            phase = .journal(entries: entries)
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

    /// Drop the key; Face ID (if custody is fresh) or passphrase reopens.
    func lock() {
        masterKey = nil
        phase = KeyCustody.hasFreshKey() ? .biometric : .unlock(hint: currentHint)
    }

    private func openJournal(with master: AesGcmKey) async throws -> [Entry] {
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
        guard let (tree, treeKeyB64) = ring.first else { return [] }
        treeId = tree
        treeKey = TraumaCrypto.shared.importTreeKey(base64Key: treeKeyB64)
        // Queued offline writes from earlier sessions push before the pull.
        _ = try? await sync.push(treeId: tree)
        return await refreshEntries()
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

    private func debugComposeIfAsked() async {
        if case .journal = phase, let compose = Self.launchArgument("-composeEntry") {
            let parts = compose.split(separator: "|", maxSplits: 1).map(String.init)
            await createEntry(title: parts.first ?? "", content: parts.count > 1 ? parts[1] : "")
        }
    }
    #endif
}
