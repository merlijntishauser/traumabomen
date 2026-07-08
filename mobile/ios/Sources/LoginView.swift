import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text(t("Traumatrees"))
                .font(Theme.heading(26))
                .foregroundStyle(Theme.textPrimary)

            Text(t("A quiet place to see what repeats, and to write about it."))
                .font(Theme.body(Theme.bodySize))
                .foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(spacing: 12) {
                TextField(t("Email"), text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .modifier(FieldStyle())

                SecureField(t("Password"), text: $password)
                    .modifier(FieldStyle())
                    .submitLabel(.go)
                    .onSubmit(submit)

                if let error = model.errorMessage {
                    Text(error)
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.danger)
                }

                Button(action: submit) {
                    Text(t("Log in"))
                        .font(Theme.body(Theme.bodySize, weight: .semibold))
                }
                .frame(width: 200, height: 44)
                .background(Theme.action, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.white)
                .disabled(email.isEmpty || password.isEmpty)
            }

            Spacer()
            Spacer()
        }
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        let (e, p) = (email, password)
        Task { await model.login(email: e, password: p) }
    }
}

struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .textFieldStyle(.plain)
            .font(Theme.body(Theme.bodySize))
            .foregroundStyle(Theme.textPrimary)
            .padding(12)
            .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.borderPrimary, lineWidth: 1))
            .padding(.horizontal, 32)
    }
}
