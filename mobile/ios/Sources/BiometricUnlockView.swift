import SwiftUI

/// The daily unlock: Face ID releases the Enclave-wrapped key. The
/// passphrase path stays one tap away, and takes over automatically after
/// 7 days or when the wrap is invalidated.
struct BiometricUnlockView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("Traumatrees")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.textPrimary)

            Text("Welcome back.")
                .font(.system(size: Theme.bodySize))
                .foregroundStyle(Theme.textMuted)

            Button {
                Task { await model.biometricUnlock() }
            } label: {
                Text("Unlock with Face ID")
                    .font(.system(size: Theme.bodySize, weight: .semibold))
            }
            .frame(width: 220, height: 44)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(.white)

            Button {
                Task { await model.usePassphraseInstead() }
            } label: {
                Text("Use passphrase instead")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()
            Spacer()
        }
    }
}
