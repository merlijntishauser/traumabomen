import SwiftUI

/// Create an account: the credentials the server checks, and the passphrase it
/// never sees. The passphrase warning is deliberately unsoftened, matching the
/// web's registration copy: losing it means losing everything.
struct RegisterView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared

    @State private var email = ""
    @State private var password = ""
    @State private var passphrase = ""
    @State private var passphraseAgain = ""

    private var passphrasesMatch: Bool {
        !passphrase.isEmpty && passphrase == passphraseAgain
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && passphrasesMatch
    }

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
                                .textContentType(.username)
                                .modifier(FieldStyle())

                            SecureField(t("Password"), text: $password)
                                .textContentType(.newPassword)
                                .modifier(FieldStyle())

                            Text(t("Your encryption passphrase is separate from your password. It unlocks your writing on this device, and we never receive it."))
                                .font(Theme.body(13))
                                .foregroundStyle(Theme.textMuted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 4)

                            SecureField(t("Encryption passphrase"), text: $passphrase)
                                .textContentType(.newPassword)
                                .modifier(FieldStyle())

                            SecureField(t("Repeat encryption passphrase"), text: $passphraseAgain)
                                .textContentType(.newPassword)
                                .modifier(FieldStyle())
                                .submitLabel(.go)
                                .onSubmit(submit)

                            if !passphraseAgain.isEmpty && !passphrasesMatch {
                                Text(t("The two passphrases do not match."))
                                    .font(Theme.body(13))
                                    .foregroundStyle(Theme.danger)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Text(t("If you lose your passphrase, your data is unrecoverable. This is by design."))
                                .font(Theme.body(13))
                                .foregroundStyle(Theme.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            if let error = model.errorMessage {
                                Text(error)
                                    .font(Theme.body(13))
                                    .foregroundStyle(Theme.danger)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button(action: submit) {
                                Text(t("Create account"))
                                    .font(Theme.body(Theme.bodySize, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                            }
                            .frame(height: 46)
                            .background(Theme.action, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                            .disabled(!canSubmit)
                            .opacity(canSubmit ? 1 : 0.6)

                            Button {
                                model.showLogin()
                            } label: {
                                Text(t("I already have an account"))
                                    .font(Theme.body(13))
                                    .foregroundStyle(.white.opacity(0.85))
                            }
                            .padding(.top, 4)
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
        guard canSubmit else { return }
        let (e, p) = (email.trimmingCharacters(in: .whitespaces), password)
        Task { await model.register(email: e, password: p) }
    }
}

/// After sign-up the account exists but cannot log in until the emailed link
/// is clicked, so this screen waits rather than pretending to be signed in.
struct VerifyPendingView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared

    let email: String

    var body: some View {
        ZStack {
            HeroBackground()
            CenteredScroll {
                VStack(spacing: 20) {
                    Spacer(minLength: 40)

                    AuthWordmark(tagline: nil)

                    GlassCard {
                        VStack(spacing: 12) {
                            Text(t("Check your email"))
                                .font(Theme.heading(22))
                                .foregroundStyle(Theme.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Text("\(t("We sent a link to")) \(email). \(t("Open it to confirm your address, then come back here and log in."))")
                                .font(Theme.body(Theme.bodySize))
                                .foregroundStyle(Theme.textMuted)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            Button {
                                model.showLogin()
                            } label: {
                                Text(t("I have confirmed, log in"))
                                    .font(Theme.body(Theme.bodySize, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                            }
                            .frame(height: 46)
                            .background(Theme.action, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                        }
                    }
                    .padding(.horizontal, 28)

                    Spacer(minLength: 40)
                }
                .appearFade()
            }
        }
    }
}
