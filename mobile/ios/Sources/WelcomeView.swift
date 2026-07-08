import SwiftUI

/// The first-launch welcome: a calm greeting, then plainly what this app is
/// for and what it is not. Mirrors the web's onboarding safety modal in
/// voice: honest about hard truths, never urgent. Shown once (a UserDefaults
/// flag), before the login screen.
struct WelcomeView: View {
    @EnvironmentObject private var model: AppModel
    let onContinue: () -> Void

    private static let seenKey = "welcome.seen"

    static var hasBeenSeen: Bool {
        get { UserDefaults.standard.bool(forKey: seenKey) }
        set { UserDefaults.standard.set(newValue, forKey: seenKey) }
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    heroHeader

                    Text(t("A quiet place to see what repeats in a family, and to write about it."))
                        .font(Theme.display(17))
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 20)
                        .padding(.horizontal, 8)

                    VStack(alignment: .leading, spacing: 22) {
                        capability(
                            icon: .network,
                            title: t("Map your family"),
                            body: t("Place the people, how they are connected, and what happened to them, across generations.")
                        )
                        capability(
                            icon: .penLine,
                            title: t("Write, at your own pace"),
                            body: t("Keep a private journal of what you notice. You set the pace; pause or stop whenever you want.")
                        )
                        capability(
                            icon: .lock,
                            title: t("Only you can read it"),
                            body: t("Everything is encrypted on this device before it is stored. We can never see your family's story.")
                        )
                    }
                    .padding(.top, 36)

                    VStack(alignment: .leading, spacing: 10) {
                        Text(t("A few honest things"))
                            .font(Theme.body(13, weight: .semibold))
                            .foregroundStyle(Theme.textMuted)

                        honest(t("This is a personal reflection tool. It is not therapy, and not crisis support."))
                        honest(t("Building the tree itself happens at the desk, on the web. Here you look, and you write."))
                        honest(t("If you lose your passphrase, your data is unrecoverable. This is by design."))
                    }
                    .padding(.top, 32)

                    Button(action: {
                        WelcomeView.hasBeenSeen = true
                        model.dismissWelcome()
                        onContinue()
                    }) {
                        Text(t("Continue"))
                            .font(Theme.body(Theme.bodySize, weight: .semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .frame(height: 48)
                    .background(Theme.action, in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
                    .padding(.top, 36)

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 28)
            }
        }
    }

    /// A forest photo banner with the wordmark over it, fading into the page.
    private var heroHeader: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { proxy in
                Image("welcome")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: 260)
                    .clipped()
                    .overlay(
                        LinearGradient(
                            colors: [Theme.bgPrimary.opacity(0.2), .clear, Theme.bgPrimary],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .overlay(AmbientMotes())
            }
            .frame(height: 260)

            Text(t("Traumatrees"))
                .font(Theme.heading(36))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 8, y: 2)
                .padding(.bottom, 8)
        }
        .frame(height: 260)
        .padding(.horizontal, -28) // escape the content inset for a full-bleed banner
        .padding(.bottom, 4)
    }

    private func capability(icon: LucideIcon, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            icon.image
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .foregroundStyle(Theme.action)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(Theme.body(Theme.bodySize, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                Text(body)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func honest(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(Theme.textMuted)
                .frame(width: 4, height: 4)
                .padding(.top, 8)
            Text(text)
                .font(Theme.body(13))
                .foregroundStyle(Theme.textMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
