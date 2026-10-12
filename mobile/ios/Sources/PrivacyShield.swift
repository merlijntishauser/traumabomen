import SwiftUI
import UIKit

/// Background privacy, per the design: the moment the app leaves the
/// foreground the content is covered (so the app-switcher snapshot shows
/// nothing), and after a grace period in the background the keys drop and
/// the next foreground lands on the lock screen.
struct PrivacyShieldModifier: ViewModifier {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    @State private var backgroundedAt: Date?

    /// How long the key may survive in the background before dropping.
    static let graceSeconds: TimeInterval = 60

    func body(content: Content) -> some View {
        content
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .active:
                    if let at = backgroundedAt,
                       Date().timeIntervalSince(at) > Self.graceSeconds {
                        model.lockIfUnlocked()
                    }
                    backgroundedAt = nil
                    PrivacyCoverWindow.shared.hide()
                case .inactive:
                    PrivacyCoverWindow.shared.show()
                case .background:
                    PrivacyCoverWindow.shared.show()
                    backgroundedAt = Date()
                @unknown default:
                    PrivacyCoverWindow.shared.show()
                }
            }
    }
}

/// The cover lives in its own window above every other, because an overlay
/// in the root view sits under presented sheets: a person page, the
/// composer or settings stayed readable in the app-switcher snapshot.
@MainActor
final class PrivacyCoverWindow {
    static let shared = PrivacyCoverWindow()

    private var window: UIWindow?

    func show() {
        guard window == nil,
              let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first
        else { return }
        let cover = UIWindow(windowScene: scene)
        cover.windowLevel = .alert + 1
        // Match the app's chosen theme; this window is outside its hierarchy.
        cover.overrideUserInterfaceStyle = scene.windows.first?.traitCollection.userInterfaceStyle ?? .unspecified
        cover.rootViewController = UIHostingController(rootView: PrivacyCover())
        cover.isHidden = false
        window = cover
    }

    func hide() {
        window?.isHidden = true
        window = nil
    }
}

/// What the app switcher shows: the unlock hero and the name, nothing else.
struct PrivacyCover: View {
    var body: some View {
        ZStack {
            HeroBackground()
            VStack(spacing: 14) {
                LockGlyph().stroke(.white, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .frame(width: 30, height: 34)
                    .shadow(color: .black.opacity(0.5), radius: 6, y: 2)
                Text(t("Traumatrees"))
                    .font(Theme.heading(26))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.5), radius: 8, y: 2)
            }
        }
        .ignoresSafeArea()
    }
}

/// A padlock in Lucide's grammar, for the privacy cover.
struct LockGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let bodyTop = rect.minY + rect.height * 0.42
        // Body
        p.addRoundedRect(
            in: CGRect(x: rect.minX, y: bodyTop, width: rect.width, height: rect.maxY - bodyTop),
            cornerSize: CGSize(width: rect.width * 0.16, height: rect.width * 0.16)
        )
        // Shackle
        let sInset = rect.width * 0.2
        p.move(to: CGPoint(x: rect.minX + sInset, y: bodyTop))
        p.addLine(to: CGPoint(x: rect.minX + sInset, y: rect.minY + rect.height * 0.24))
        p.addArc(
            center: CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.24),
            radius: rect.width / 2 - sInset,
            startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false
        )
        p.addLine(to: CGPoint(x: rect.maxX - sInset, y: bodyTop))
        return p
    }
}
