import SwiftUI

/// Domain marks drawn in Lucide's grammar (24x24 grid, 2px stroke, round
/// caps and joins), since Lucide itself is web-only. Each is a Shape stroked
/// by the caller so it inherits the theme color.
enum Icon {
    case journal
    case tree
    case settings
    case lock

    func path(in rect: CGRect) -> Path {
        // Normalize to a 24x24 grid, then scale to the rect.
        let s = min(rect.width, rect.height) / 24
        let ox = rect.minX + (rect.width - 24 * s) / 2
        let oy = rect.minY + (rect.height - 24 * s) / 2
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }

        var path = Path()
        switch self {
        case .journal:
            // An open book / journal: two facing pages with a spine.
            path.move(to: p(3, 5))
            path.addLine(to: p(11, 6))
            path.addLine(to: p(11, 20))
            path.addLine(to: p(3, 19))
            path.closeSubpath()
            path.move(to: p(21, 5))
            path.addLine(to: p(13, 6))
            path.addLine(to: p(13, 20))
            path.addLine(to: p(21, 19))
            path.closeSubpath()
        case .tree:
            // A small three-node tree: one parent branching to two children.
            path.addEllipse(in: CGRect(x: ox + 9 * s, y: oy + 3 * s, width: 6 * s, height: 6 * s))
            path.addEllipse(in: CGRect(x: ox + 3 * s, y: oy + 15 * s, width: 6 * s, height: 6 * s))
            path.addEllipse(in: CGRect(x: ox + 15 * s, y: oy + 15 * s, width: 6 * s, height: 6 * s))
            path.move(to: p(12, 9))
            path.addLine(to: p(12, 12))
            path.move(to: p(6, 15))
            path.addLine(to: p(6, 12))
            path.addLine(to: p(18, 12))
            path.addLine(to: p(18, 15))
        case .settings:
            // A simplified gear: a ring with four spokes (Lucide-ish).
            path.addEllipse(in: CGRect(x: ox + 8 * s, y: oy + 8 * s, width: 8 * s, height: 8 * s))
            for angle in stride(from: 0.0, to: 360.0, by: 90.0) {
                let a = angle * .pi / 180
                path.move(to: p(12 + 8 * cos(a), 12 + 8 * sin(a)))
                path.addLine(to: p(12 + 11 * cos(a), 12 + 11 * sin(a)))
            }
        case .lock:
            // A padlock: body plus shackle.
            path.addRoundedRect(
                in: CGRect(x: ox + 5 * s, y: oy + 11 * s, width: 14 * s, height: 10 * s),
                cornerSize: CGSize(width: 2 * s, height: 2 * s)
            )
            path.move(to: p(8, 11))
            path.addLine(to: p(8, 7))
            path.addCurve(to: p(16, 7), control1: p(8, 3), control2: p(16, 3))
            path.addLine(to: p(16, 11))
        }
        return path
    }
}

/// A tappable nav item: the Lucide-grammar mark above its label, tinted by
/// selection.
struct NavItem: View {
    let icon: Icon
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                IconShape(icon: icon)
                    .stroke(
                        selected ? Theme.action : Theme.textMuted,
                        style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                    )
                    .frame(width: 24, height: 24)
                Text(label)
                    .font(Theme.body(11, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? Theme.textPrimary : Theme.textMuted)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

struct IconShape: Shape {
    let icon: Icon
    func path(in rect: CGRect) -> Path { icon.path(in: rect) }
}
