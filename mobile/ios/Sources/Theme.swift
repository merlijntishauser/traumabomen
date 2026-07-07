import SwiftUI
import UIKit

/// Theme mode, mirroring the web's chooser: follow the system, or pin
/// light/dark. Persisted in UserDefaults.
enum ThemeMode: String, CaseIterable {
    case auto, light, dark

    private static let key = "theme.mode"

    static var current: ThemeMode {
        get { ThemeMode(rawValue: UserDefaults.standard.string(forKey: key) ?? "") ?? .auto }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: key) }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .auto: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var label: String {
        switch self {
        case .auto: "Auto"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

/// Design tokens from frontend/src/styles/theme.css, both themes: the dark
/// midnight forest and the light morning-linen with its deliberate indigo
/// accent (green-on-cream reads generic wellness; indigo reads literary).
/// Every color adapts to the active scheme automatically.
enum Theme {
    // Surfaces
    static let bgPrimary = dynamic(dark: 0x0a1a0f, light: 0xf7f5f2)
    static let bgSecondary = dynamic(dark: 0x0f261a, light: 0xffffff)
    static let borderPrimary = dynamic(dark: 0x1f4d35, light: 0xd4cec6)

    // Text
    static let textPrimary = dynamic(dark: 0xe0e8e3, light: 0x2c3340)
    static let textSecondary = dynamic(dark: 0xa8bfb1, light: 0x6b7a8d)
    static let textMuted = dynamic(dark: 0x7a9a84, light: 0x9aa5b2)

    // Brand accent: forest green in dark, indigo in light.
    static let accent = dynamic(dark: 0x2d8a5e, light: 0x4f46e5)
    // What the user does (buttons, links): green in dark, the same indigo in light.
    static let action = dynamic(dark: 0x339a66, light: 0x4f46e5)

    static let danger = dynamic(dark: 0xef4444, light: 0xdc2626)

    static let bodySize: CGFloat = 15

    // The three faces: the handwriting voice, the literary serif (reserved,
    // bundled for coming public-facing surfaces), and the body sans.
    static func heading(_ size: CGFloat) -> Font {
        Font.custom("Playwrite NZ Basic", size: size)
    }

    static func display(_ size: CGFloat) -> Font {
        Font.custom("Fraunces", size: size)
    }

    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom("Lato", size: size).weight(weight)
    }

    private static func dynamic(dark: UInt32, light: UInt32) -> Color {
        Color(UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

private extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xff) / 255,
            green: CGFloat((rgb >> 8) & 0xff) / 255,
            blue: CGFloat(rgb & 0xff) / 255,
            alpha: 1
        )
    }
}
