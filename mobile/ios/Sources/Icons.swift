import SwiftUI

/// The website's iconography: the actual Lucide glyphs, bundled as vector PDF
/// template assets (ISC-licensed, see Resources/Assets.xcassets and the About
/// screen). Rendered as template images so they take the theme color.
enum LucideIcon: String {
    case bookOpen = "book-open"
    case network
    case penLine = "pen-line"
    case lock
    case settings

    var image: Image { Image(rawValue).renderingMode(.template) }
}

/// A bottom-bar item: the Lucide mark above its label. A tab item highlights
/// when it is the active view; an action item (settings, lock) stays muted.
struct NavItem: View {
    let icon: LucideIcon
    let label: String
    var selected: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                icon.image
                    .resizable()
                    .scaledToFit()
                    .frame(width: 23, height: 23)
                    .foregroundStyle(selected ? Theme.action : Theme.textMuted)
                Text(label)
                    .font(Theme.body(11, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Theme.textPrimary : Theme.textMuted)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
