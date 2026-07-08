import SwiftUI

/// Passphrase entry after login: the salt came from the server, the key is
/// derived on-device, and a wrong passphrase surfaces here quietly. The
/// stored hint (if any) is shown, exactly like the web unlock page.
struct UnlockView: View {
    @EnvironmentObject private var model: AppModel
    let hint: String?

    @State private var passphrase = ""

    var body: some View {
        CenteredScroll {
        VStack(spacing: 24) {
            Spacer()

            Text(t("Traumatrees"))
                .font(Theme.heading(26))
                .foregroundStyle(Theme.textPrimary)

            Text(t("Your encryption passphrase unlocks your data on this device. We can never read it."))
                .font(Theme.body(Theme.bodySize))
                .foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(spacing: 12) {
                SecureField(t("Encryption passphrase"), text: $passphrase)
                    .textFieldStyle(.plain)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(12)
                    .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10).stroke(Theme.borderPrimary, lineWidth: 1)
                    )
                    .padding(.horizontal, 32)
                    .submitLabel(.go)
                    .onSubmit(submit)

                if let hint, !hint.isEmpty {
                    Text("\(t("Hint")): \(hint)")
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                }

                if let error = model.errorMessage {
                    Text(error)
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.danger)
                }

                Button(action: submit) {
                    Text(t("Unlock"))
                        .font(Theme.body(Theme.bodySize, weight: .semibold))
                }
                .frame(width: 200, height: 44)
                .background(Theme.action, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.white)
                .disabled(passphrase.isEmpty)
            }

            Spacer()
            Spacer()
        }
        }
    }

    private func submit() {
        guard !passphrase.isEmpty else { return }
        let entered = passphrase
        Task { await model.unlock(passphrase: entered) }
    }
}
