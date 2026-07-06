import Foundation
import TraumabomenCore

/// The app's state machine: login -> unlock -> journal. Owns the API client
/// and, after unlock, the in-memory master key. Locking drops the key; no
/// key material is persisted anywhere yet (Secure Enclave custody is the
/// next slice, as its own deliberate step).
@MainActor
final class AppModel: ObservableObject {
    enum Phase {
        case login
        case unlock(hint: String?)
        case working(String)
        case journal(entries: [Entry])
    }

    struct Entry: Identifiable {
        let id: String
        let title: String
        let content: String
    }

    @Published var phase: Phase = .login
    @Published var errorMessage: String?

    private let api: ApiClient
    private var saltBase64: String?
    private var masterKey: AesGcmKey?

    init() {
        let base = Self.launchArgument("-apiBase") ?? "http://localhost:8000"
        api = PlatformHttpKt.createApiClient(baseUrl: base)
    }

    func login(email: String, password: String) async {
        errorMessage = nil
        phase = .working("Logging in")
        do {
            let salt = try await api.login(email: email, password: password)
            saltBase64 = salt.encryptionSalt
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
        do {
            let master = await Self.deriveKey(passphrase: passphrase, salt: salt)
            let ringBlob = try await api.fetchKeyRing()
            // A wrong passphrase fails right here, on authenticated decryption.
            let ring = try TraumaCrypto.shared.decryptKeyRing(
                encryptedKeyRing: ringBlob, masterKey: master
            )
            guard let (treeId, treeKeyB64) = ring.first else {
                masterKey = master
                phase = .journal(entries: [])
                return
            }
            let treeKey = TraumaCrypto.shared.importTreeKey(base64Key: treeKeyB64)
            let pulled = try await api.pullEntities(treeId: treeId, type: .journalEntries)
            let entries = pulled.compactMap { Self.decryptEntry($0, key: treeKey) }
            masterKey = master
            phase = .journal(entries: entries)
        } catch {
            errorMessage = "Incorrect passphrase."
            phase = .unlock(hint: hint)
        }
    }

    /// Drop the key; the journal is gone from memory until the next unlock.
    func lock() {
        masterKey = nil
        phase = .unlock(hint: currentHint)
    }

    private var currentHint: String? {
        if case .unlock(let hint) = phase { return hint }
        return nil
    }

    /// Argon2id costs about a second by design; never run it on the main actor.
    private nonisolated static func deriveKey(passphrase: String, salt: String) async -> AesGcmKey {
        await Task.detached(priority: .userInitiated) {
            TraumaCrypto.shared.deriveMasterKey(passphrase: passphrase, saltBase64: salt)
        }.value
    }

    private struct BlobJson: Decodable {
        let iv: String
        let ciphertext: String
    }

    private struct EntryJson: Decodable {
        let title: String
        let content: String
    }

    private nonisolated static func decryptEntry(_ entity: ServerEntity, key: AesGcmKey) -> Entry? {
        guard
            let blob = try? JSONDecoder().decode(BlobJson.self, from: Data(entity.encryptedData.utf8)),
            let plaintext = try? key.decrypt(blob: EncryptedBlob(iv: blob.iv, ciphertext: blob.ciphertext)),
            let entry = try? JSONDecoder().decode(EntryJson.self, from: Data(plaintext.utf8))
        else { return nil }
        return Entry(id: entity.id, title: entry.title, content: entry.content)
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
        guard
            let email = Self.launchArgument("-email"),
            let password = Self.launchArgument("-password")
        else { return }
        await login(email: email, password: password)
        if case .unlock = phase, let passphrase = Self.launchArgument("-unlockPassphrase") {
            await unlock(passphrase: passphrase)
        }
    }
    #endif
}
