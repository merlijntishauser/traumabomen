import SwiftUI

/// Passphrase entry after login. The forest-cabin hero frames it as unlocking
/// your own private shelter; the salt came from the server, the key is derived
/// on device, and a wrong passphrase surfaces here quietly.
struct UnlockView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared
    let hint: String?

    @State private var passphrase = ""

    var body: some View {
        ZStack {
            HeroBackground()
            CenteredScroll {
                VStack(spacing: 20) {
                    Spacer(minLength: 40)

                    AuthWordmark(tagline: t("Your encryption passphrase unlocks your data on this device. We can never read it."))

                    GlassCard {
                        VStack(spacing: 12) {
                            SecureField(t("Encryption passphrase"), text: $passphrase)
                                .modifier(FieldStyle())
                                .submitLabel(.go)
                                .onSubmit(submit)

                            if let hint, !hint.isEmpty {
                                Text("\(t("Hint")): \(hint)")
                                    .font(Theme.body(13))
                                    .foregroundStyle(Theme.textMuted)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            if let error = model.errorMessage {
                                Text(error)
                                    .font(Theme.body(13))
                                    .foregroundStyle(Theme.danger)
                            }

                            Button(action: submit) {
                                Text(t("Unlock"))
                                    .font(Theme.body(Theme.bodySize, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                            }
                            .frame(height: 46)
                            .background(Theme.action, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                            .disabled(passphrase.isEmpty)
                            .opacity(passphrase.isEmpty ? 0.6 : 1)
                        }
                    }
                    .padding(.horizontal, 28)

                    Spacer(minLength: 40)
                }
                .appearFade()
            }
        }
    }

    private func submit() {
        guard !passphrase.isEmpty else { return }
        let entered = passphrase
        Task { await model.unlock(passphrase: entered) }
    }
}
