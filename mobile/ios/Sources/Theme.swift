import SwiftUI

/// Dark-theme tokens from frontend/src/styles/theme.css. The three brand
/// fonts (Playwrite NZ Basic, Fraunces, Lato) get bundled in a later slice;
/// until then the system font stands in with the same weight discipline
/// (headings light, body regular, 15pt base).
enum Theme {
    static let bgPrimary = Color(red: 0x0a / 255, green: 0x1a / 255, blue: 0x0f / 255)
    static let bgSecondary = Color(red: 0x0f / 255, green: 0x26 / 255, blue: 0x1a / 255)
    static let borderPrimary = Color(red: 0x1f / 255, green: 0x4d / 255, blue: 0x35 / 255)
    static let textPrimary = Color(red: 0xe0 / 255, green: 0xe8 / 255, blue: 0xe3 / 255)
    static let textMuted = Color(red: 0x7a / 255, green: 0x9a / 255, blue: 0x84 / 255)
    static let accent = Color(red: 0x2d / 255, green: 0x8a / 255, blue: 0x5e / 255)
    static let danger = Color(red: 0xef / 255, green: 0x44 / 255, blue: 0x44 / 255)

    static let bodySize: CGFloat = 15
}
