import SwiftUI
import TraumabomenCore

/// First proof of the whole native unlock path, offline: passphrase ->
/// Argon2id (libsodium via the KMP core) -> key ring decrypt -> tree key ->
/// journal entry decrypt. The data is the golden compatibility fixture the
/// web client generated, so what this screen decrypts is literally
/// web-encrypted content. Server login and Secure Enclave custody replace
/// the fixture in the next M3 slices.
struct UnlockView: View {
    @State private var passphrase = ""
    @State private var state: UnlockState = .locked

    enum UnlockState {
        case locked
        case working
        case failed
        case unlocked(title: String, content: String)
    }

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
        }
        .overlay(content)
        #if DEBUG
        // Test affordance: simctl launch ... -unlockPassphrase "..." drives
        // the unlock without a keyboard (fixture data only, never user data).
        .onAppear {
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-unlockPassphrase"), i + 1 < args.count {
                passphrase = args[i + 1]
                unlock()
            }
        }
        #endif
    }

    private var content: some View {
        ZStack {
            VStack(spacing: 24) {
                Spacer()

                Text("Traumatrees")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Theme.textPrimary)

                Text("Your encryption passphrase unlocks your data on this device. We can never read it.")
                    .font(.system(size: Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                switch state {
                case .unlocked(let title, let content):
                    unlockedCard(title: title, content: content)
                default:
                    unlockForm
                }

                Spacer()
                Spacer()
            }
        }
    }

    private var unlockForm: some View {
        VStack(spacing: 12) {
            SecureField("Encryption passphrase", text: $passphrase)
                .textFieldStyle(.plain)
                .font(.system(size: Theme.bodySize))
                .foregroundStyle(Theme.textPrimary)
                .padding(12)
                .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10).stroke(Theme.borderPrimary, lineWidth: 1)
                )
                .padding(.horizontal, 32)
                .submitLabel(.go)
                .onSubmit(unlock)

            if case .failed = state {
                Text("Incorrect passphrase.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.danger)
            }

            Button(action: unlock) {
                if case .working = state {
                    ProgressView().tint(Theme.textPrimary)
                } else {
                    Text("Unlock")
                        .font(.system(size: Theme.bodySize, weight: .semibold))
                }
            }
            .frame(width: 200, height: 44)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(.white)
            .disabled(passphrase.isEmpty || isWorking)
        }
    }

    private func unlockedCard(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 20, weight: .light))
                .foregroundStyle(Theme.textPrimary)
            Text(content)
                .font(.system(size: Theme.bodySize))
                .foregroundStyle(Theme.textMuted)
            Text("Decrypted on this device from web-encrypted data.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.accent)
                .padding(.top, 8)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.borderPrimary, lineWidth: 1))
        .padding(.horizontal, 32)
    }

    private var isWorking: Bool {
        if case .working = state { return true }
        return false
    }

    private func unlock() {
        guard !passphrase.isEmpty, !isWorking else { return }
        state = .working
        let entered = passphrase

        // Argon2id takes around a second on purpose; keep it off the main actor.
        Task.detached(priority: .userInitiated) {
            let result = Self.attemptUnlock(passphrase: entered)
            await MainActor.run {
                switch result {
                case .some(let entry):
                    state = .unlocked(title: entry.title, content: entry.content)
                case .none:
                    state = .failed
                }
            }
        }
    }

    private struct JournalEntry: Decodable {
        let title: String
        let content: String
    }

    private struct BlobJson: Decodable {
        let iv: String
        let ciphertext: String
    }

    private nonisolated static func attemptUnlock(passphrase: String) -> JournalEntry? {
        let crypto = TraumaCrypto.shared
        let masterKey = crypto.deriveMasterKey(passphrase: passphrase, saltBase64: Fixture.salt)
        do {
            let keyRing = try crypto.decryptKeyRing(
                encryptedKeyRing: Fixture.encryptedKeyRing, masterKey: masterKey
            )
            guard let treeKeyB64 = keyRing[Fixture.treeId] else { return nil }
            let treeKey = crypto.importTreeKey(base64Key: treeKeyB64)

            let blob = try JSONDecoder().decode(
                BlobJson.self, from: Data(Fixture.encryptedJournal.utf8)
            )
            let plaintext = try treeKey.decrypt(
                blob: EncryptedBlob(iv: blob.iv, ciphertext: blob.ciphertext)
            )
            return try JSONDecoder().decode(JournalEntry.self, from: Data(plaintext.utf8))
        } catch {
            return nil
        }
    }
}

/// Values from frontend/src/fixtures/crypto-compat.fixture.json: content the
/// web client encrypted, decryptable only with its passphrase.
private enum Fixture {
    static let salt = "oxmdMfGjoehnIE174Ow5Fg=="
    static let treeId = "6b1f7c2e-9a44-4d0b-8b3a-2f5e8d1c0a97"
    static let encryptedKeyRing =
        #"{"iv":"8E5gNypyQ9X9bTYB","ciphertext":"GQc96Ad/ZZuKOz46ye3xQO/srvFxjNYU6EMx8jaGtv9tx7QXXDofT71QXd0LbBpdgg0S8XvclQJiWA5zP4XHux9RfcNubT6yrXa/YUi7IF1HWpoZokrzVKe00XOcTXAekR3Z9iTmyQ=="}"#
    static let encryptedJournal =
        #"{"iv":"s6Bl4z8x8sjqBuEo","ciphertext":"VHhb4yBBKEDlTzS/Jpvj53QlWZztmtEJTFKb//HqHcFsAHMG+CJXEzeJw+o+BBZqMPt/MOubcrbv6AuXX93vVL8ewaWGJaOOmnX8r/wLlBRW/CDLY5xqpY5Nlg=="}"#
}
