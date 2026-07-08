import SwiftUI

/// The daily unlock: Face ID releases the Enclave-wrapped key. The
/// passphrase path stays one tap away, and takes over automatically after
/// 7 days or when the wrap is invalidated.
struct BiometricUnlockView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        CenteredScroll {
        VStack(spacing: 24) {
            Spacer()

            Text(t("Traumatrees"))
                .font(Theme.heading(26))
                .foregroundStyle(Theme.textPrimary)

            Text(t("Welcome back."))
                .font(Theme.body(Theme.bodySize))
                .foregroundStyle(Theme.textMuted)

            Button {
                Task { await model.biometricUnlock() }
            } label: {
                Text(t("Unlock with Face ID"))
                    .font(Theme.body(Theme.bodySize, weight: .semibold))
            }
            .frame(width: 220, height: 44)
            .background(Theme.action, in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(.white)

            Button {
                Task { await model.usePassphraseInstead() }
            } label: {
                Text(t("Use passphrase instead"))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()
            Spacer()
        }
        }
    }
}
