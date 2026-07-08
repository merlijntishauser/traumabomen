import SwiftUI

/// Background privacy, per the design: the moment the app leaves the
/// foreground the content is covered (so the app-switcher snapshot shows
/// nothing), and after a grace period in the background the keys drop and
/// the next foreground lands on the lock screen.
struct PrivacyShieldModifier: ViewModifier {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    @State private var covered = false
    @State private var backgroundedAt: Date?

    /// How long the key may survive in the background before dropping.
    static let graceSeconds: TimeInterval = 60

    func body(content: Content) -> some View {
        ZStack {
            content
            if covered {
                ZStack {
                    AppBackground()
                    Text(t("Traumatrees"))
                        .font(Theme.heading(24))
                        .foregroundStyle(Theme.textMuted)
                }
                .transition(.opacity)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                if let at = backgroundedAt,
                   Date().timeIntervalSince(at) > Self.graceSeconds {
                    model.lockIfUnlocked()
                }
                backgroundedAt = nil
                covered = false
            case .inactive:
                covered = true
            case .background:
                covered = true
                backgroundedAt = Date()
            @unknown default:
                covered = true
            }
        }
    }
}
