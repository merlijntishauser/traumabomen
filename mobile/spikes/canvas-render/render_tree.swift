// Spike: render a Traumatrees tree natively from extracted web geometry.
//
// layout.json holds node positions/sizes/badges and edge paths exactly as the
// React Flow canvas rendered them for the demo family (dark theme). This
// script replays that geometry with CoreGraphics, the same drawing substrate
// SwiftUI Canvas uses on iOS, producing native-render.png for side-by-side
// comparison with web-reference.png.
//
// Run: swift render_tree.swift   (from this directory)

import AppKit
import Foundation

struct Badge: Codable { let kind: String; let color: String; let initial: String? }
struct Node: Codable {
    let id: String; let x: CGFloat; let y: CGFloat; let w: CGFloat; let h: CGFloat
    let pill: Bool; let name: String; let years: String; let badges: [Badge]
}
struct Edge: Codable {
    let id: String; let path: String; let stroke: String; let dash: String?; let width: CGFloat
}
struct Layout: Codable { let nodes: [Node]; let edges: [Edge] }

// Dark theme tokens from frontend/src/styles/theme.css
let bgPrimary = NSColor(srgbRed: 0x0a / 255, green: 0x1a / 255, blue: 0x0f / 255, alpha: 1)
let bgSecondary = NSColor(srgbRed: 0x0f / 255, green: 0x26 / 255, blue: 0x1a / 255, alpha: 1)
let borderPrimary = NSColor(srgbRed: 0x1f / 255, green: 0x4d / 255, blue: 0x35 / 255, alpha: 1)
let textPrimary = NSColor(srgbRed: 0xe0 / 255, green: 0xe8 / 255, blue: 0xe3 / 255, alpha: 1)
let textMuted = NSColor(srgbRed: 0x7a / 255, green: 0x9a / 255, blue: 0x84 / 255, alpha: 1)

func parseColor(_ s: String) -> NSColor {
    if s.hasPrefix("rgb") {
        let n = s.dropFirst(s.hasPrefix("rgba") ? 5 : 4).dropLast()
            .split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        return NSColor(srgbRed: n[0] / 255, green: n[1] / 255, blue: n[2] / 255, alpha: n.count > 3 ? n[3] : 1)
    }
    if s.hasPrefix("hsl") {
        let n = s.dropFirst(4).dropLast()
            .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "%", with: "") }
            .compactMap { Double($0) }
        return NSColor(hue: n[0] / 360, saturation: n[1] / 100, brightness: 0, alpha: 1)
            .usingColorSpace(.sRGB).map { _ in hslToColor(h: n[0], s: n[1] / 100, l: n[2] / 100) } ?? .white
    }
    return .white
}

func hslToColor(h: Double, s: Double, l: Double) -> NSColor {
    let c = (1 - abs(2 * l - 1)) * s
    let hp = h / 60
    let x = c * (1 - abs(hp.truncatingRemainder(dividingBy: 2) - 1))
    let (r1, g1, b1): (Double, Double, Double)
    switch hp {
    case ..<1: (r1, g1, b1) = (c, x, 0)
    case ..<2: (r1, g1, b1) = (x, c, 0)
    case ..<3: (r1, g1, b1) = (0, c, x)
    case ..<4: (r1, g1, b1) = (0, x, c)
    case ..<5: (r1, g1, b1) = (x, 0, c)
    default: (r1, g1, b1) = (c, 0, x)
    }
    let m = l - c / 2
    return NSColor(srgbRed: r1 + m, green: g1 + m, blue: b1 + m, alpha: 1)
}

/// Minimal SVG path parser: absolute M, L, Q, C (all React Flow emits here).
func parseSvgPath(_ d: String) -> CGMutablePath {
    let path = CGMutablePath()
    let scanner = Scanner(string: d)
    scanner.charactersToBeSkipped = CharacterSet(charactersIn: " ,\n")
    var current = CGPoint.zero
    func point() -> CGPoint {
        let x = scanner.scanDouble() ?? 0
        let y = scanner.scanDouble() ?? 0
        return CGPoint(x: x, y: y)
    }
    while !scanner.isAtEnd {
        guard let cmd = scanner.scanCharacter() else { break }
        switch cmd {
        case "M": current = point(); path.move(to: current)
        case "L": current = point(); path.addLine(to: current)
        case "Q":
            let c = point(); current = point()
            path.addQuadCurve(to: current, control: c)
        case "C":
            let c1 = point(); let c2 = point(); current = point()
            path.addCurve(to: current, control1: c1, control2: c2)
        default: break
        }
    }
    return path
}

func parseDash(_ s: String?) -> [CGFloat] {
    guard let s else { return [] }
    return s.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: CharacterSet(charactersIn: " px"))) }.map { CGFloat($0) }
}

let dir = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
let layout = try JSONDecoder().decode(Layout.self, from: Data(contentsOf: dir.appendingPathComponent("layout.json")))

let margin: CGFloat = 48
let maxX = layout.nodes.map { $0.x + $0.w }.max()! + margin
let maxY = layout.nodes.map { $0.y + $0.h }.max()! + margin
let size = CGSize(width: maxX + margin, height: maxY + margin)

let image = NSImage(size: size)
image.lockFocusFlipped(true) // flip so extracted web coordinates apply directly
let ctx = NSGraphicsContext.current!.cgContext

// Background
ctx.setFillColor(bgPrimary.cgColor)
ctx.fill(CGRect(origin: .zero, size: size))

ctx.translateBy(x: margin, y: margin)

// Edges first (under nodes)
for edge in layout.edges {
    ctx.saveGState()
    ctx.addPath(parseSvgPath(edge.path))
    ctx.setStrokeColor(parseColor(edge.stroke).cgColor)
    ctx.setLineWidth(edge.width)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    let dash = parseDash(edge.dash)
    if !dash.isEmpty { ctx.setLineDash(phase: 0, lengths: dash) }
    ctx.strokePath()
    ctx.restoreGState()
}

func drawText(_ text: String, at point: CGPoint, size: CGFloat, weight: NSFont.Weight, color: NSColor) {
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
    ]
    NSAttributedString(string: text, attributes: attrs).draw(at: point)
}

for node in layout.nodes {
    let rect = CGRect(x: node.x, y: node.y, width: node.w, height: node.h)
    let radius: CGFloat = node.pill ? node.h / 2 : 10
    let card = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(card)
    ctx.setFillColor(bgSecondary.cgColor)
    ctx.fillPath()
    ctx.addPath(card)
    ctx.setStrokeColor(borderPrimary.cgColor)
    ctx.setLineWidth(1)
    ctx.strokePath()

    if node.pill {
        drawText(node.name, at: CGPoint(x: node.x + 12, y: node.y + (node.h - 13) / 2 - 1), size: 10.5, weight: .medium, color: textMuted)
        continue
    }

    drawText(node.name, at: CGPoint(x: node.x + 12, y: node.y + 10), size: 13, weight: .semibold, color: textPrimary)
    drawText(node.years, at: CGPoint(x: node.x + 12, y: node.y + 28), size: 11, weight: .regular, color: textMuted)

    // Badge row: circles trauma, squares life events, triangles classifications, star turning points
    var bx = node.x + 12
    let by = node.y + node.h - 22
    let s: CGFloat = 13
    for badge in node.badges {
        let color = parseColor(badge.color)
        ctx.setFillColor(color.cgColor)
        switch badge.kind {
        case "square":
            ctx.fill(CGRect(x: bx, y: by, width: s, height: s).insetBy(dx: 0.5, dy: 0.5))
        case "triangle":
            ctx.beginPath()
            ctx.move(to: CGPoint(x: bx + s / 2, y: by))
            ctx.addLine(to: CGPoint(x: bx + s, y: by + s))
            ctx.addLine(to: CGPoint(x: bx, y: by + s))
            ctx.closePath()
            ctx.fillPath()
        case "star":
            let c = CGPoint(x: bx + s / 2, y: by + s / 2)
            ctx.beginPath()
            for i in 0..<10 {
                let r = i % 2 == 0 ? s / 2 : s / 4.6
                let a = -CGFloat.pi / 2 + CGFloat(i) * .pi / 5
                let p = CGPoint(x: c.x + r * cos(a), y: c.y + r * sin(a))
                i == 0 ? ctx.move(to: p) : ctx.addLine(to: p)
            }
            ctx.closePath()
            ctx.fillPath()
        default:
            ctx.fillEllipse(in: CGRect(x: bx, y: by, width: s, height: s))
        }
        if let initial = badge.initial {
            drawText(initial, at: CGPoint(x: bx + 3.5, y: by + 1), size: 8, weight: .bold, color: bgPrimary)
        }
        bx += s + 5
    }
}

image.unlockFocus()

let tiff = image.tiffRepresentation!
let png = NSBitmapImageRep(data: tiff)!.representation(using: .png, properties: [:])!
try png.write(to: dir.appendingPathComponent("native-render.png"))
print("wrote native-render.png (\(Int(size.width))x\(Int(size.height)))")
