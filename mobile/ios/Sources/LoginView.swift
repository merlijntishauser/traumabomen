import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ZStack {
            HeroBackground()
            CenteredScroll {
                VStack(spacing: 20) {
                    Spacer(minLength: 40)

                    AuthWordmark(tagline: t("A quiet place to see what repeats, and to write about it."))

                    GlassCard {
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
                                    .frame(maxWidth: .infinity)
                            }
                            .frame(height: 46)
                            .background(Theme.action, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                            .disabled(email.isEmpty || password.isEmpty)
                            .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)
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
        guard !email.isEmpty, !password.isEmpty else { return }
        let (e, p) = (email, password)
        Task { await model.login(email: e, password: p) }
    }
}

/// The wordmark over hero photography: the handwriting voice in white with a
/// soft shadow for legibility on both themes' forest scenes, plus the tagline.
struct AuthWordmark: View {
    var tagline: String?

    var body: some View {
        VStack(spacing: 12) {
            Text(t("Traumatrees"))
                .font(Theme.heading(30))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 8, y: 2)
            if let tagline {
                Text(tagline)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .shadow(color: .black.opacity(0.5), radius: 6, y: 1)
                    .padding(.horizontal, 36)
            }
        }
    }
}

struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .textFieldStyle(.plain)
            .font(Theme.body(Theme.bodySize))
            .foregroundStyle(Theme.textPrimary)
            .padding(13)
            .background(Theme.bgPrimary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.borderPrimary, lineWidth: 1))
    }
}
