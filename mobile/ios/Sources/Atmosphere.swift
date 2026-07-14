import SwiftUI

/// The in-app background: the web's bg-gradient recreated. A soft radial wash
/// of the accent from the top-right and bottom-left over the base surface,
/// with a barely-there noise texture to stop the gradient banding. Calm, not
/// decorative; it gives every screen quiet depth instead of a flat fill.
struct AppBackground: View {
    var body: some View {
        ZStack {
            Theme.bgPrimary
            // Top-right wash.
            RadialGradient(
                colors: [Theme.accent.opacity(0.10), Theme.accent.opacity(0.03), .clear],
                center: UnitPoint(x: 0.82, y: -0.1),
                startRadius: 0,
                endRadius: 520
            )
            // Bottom-left wash.
            RadialGradient(
                colors: [Theme.accent.opacity(0.10), Theme.accent.opacity(0.04), .clear],
                center: UnitPoint(x: 0, y: 1.05),
                startRadius: 0,
                endRadius: 460
            )
            Noise().opacity(0.02)
        }
        .ignoresSafeArea()
    }
}

/// A hero forest photograph behind the trust surfaces (login, unlock, lock),
/// theme-aware, with a gradient veil fading to the app surface so a glass card
/// and text read cleanly over it. A slow drift of ambient light rides over it,
/// exactly like the web's auth hero.
struct HeroBackground: View {
    var image: String = "hero-unlock"

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Theme.bgPrimary
                Image(image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                // Veil: darker toward the edges and bottom so the card and the
                // status bar stay legible, easing into the app surface.
                LinearGradient(
                    colors: [
                        Theme.bgPrimary.opacity(0.55),
                        Theme.bgPrimary.opacity(0.25),
                        Theme.bgPrimary.opacity(0.7),
                        Theme.bgPrimary.opacity(0.96),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                AmbientMotes()
            }
        }
        // Ignore the keyboard region too (not just the container insets): the
        // hero must stay full-screen when a field is focused. Otherwise the
        // GeometryReader shrinks with the keyboard and the photo pulls away,
        // leaving the plain surface showing at the top. The scroll content
        // still avoids the keyboard on its own.
        .ignoresSafeArea()
    }
}

/// A slow drift of soft light over the hero photography: fireflies in the dark
/// theme, warm motes in the light one. The web's signature ambient life,
/// deliberately gentle (the subject matter is sensitive) and disabled entirely
/// under Reduce Motion.
struct AmbientMotes: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme

    private struct Mote {
        let x: CGFloat        // 0...1 horizontal home
        let y: CGFloat        // 0...1 vertical home
        let drift: CGFloat    // horizontal sway amplitude
        let rise: CGFloat     // vertical travel over a cycle
        let size: CGFloat
        let period: Double    // seconds per cycle
        let phase: Double
    }

    private let motes: [Mote] = (0..<26).map { i in
        // Deterministic pseudo-random layout (no per-launch flicker).
        func h(_ n: Int) -> Double {
            let x = sin(Double(n) * 12.9898) * 43758.5453
            return x - x.rounded(.down)
        }
        return Mote(
            x: CGFloat(h(i * 3 + 1)),
            y: CGFloat(h(i * 3 + 2)),
            drift: 8 + CGFloat(h(i * 3 + 3)) * 22,
            rise: 20 + CGFloat(h(i + 7)) * 60,
            size: 1.5 + CGFloat(h(i + 11)) * 2.5,
            period: 6 + h(i + 13) * 10,
            phase: h(i + 17) * 6.283
        )
    }

    var body: some View {
        if reduceMotion {
            Color.clear
        } else {
            TimelineView(.animation) { timeline in
                Canvas { ctx, size in
                    let time = timeline.date.timeIntervalSinceReferenceDate
                    let glow = scheme == .dark
                        ? Color(red: 0.7, green: 0.95, blue: 0.6)   // firefly green-gold
                        : Color(red: 1.0, green: 0.93, blue: 0.75)  // warm mote
                    for m in motes {
                        let t = (time / m.period + m.phase)
                        let sway = sin(t * 2) * m.drift
                        let riseY = (sin(t) * 0.5 + 0.5) * m.rise
                        let px = m.x * size.width + sway
                        let py = m.y * size.height - riseY
                        // Gentle opacity pulse.
                        let a = 0.12 + (sin(t * 1.7 + m.phase) * 0.5 + 0.5) * 0.28
                        var circle = ctx
                        circle.addFilter(.blur(radius: m.size * 1.2))
                        circle.fill(
                            Path(ellipseIn: CGRect(x: px, y: py, width: m.size * 2, height: m.size * 2)),
                            with: .color(glow.opacity(a))
                        )
                    }
                }
            }
            .allowsHitTesting(false)
        }
    }
}

/// A soft translucent card for content over hero photography. The design
/// reserves glass for exactly these auth/lock surfaces, never data-dense ones.
struct GlassCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(28)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.35), radius: 30, y: 12)
    }
}

extension View {
    /// A gentle entrance: fade and a small upward settle when the view appears.
    /// The only screen-level motion, in keeping with the restrained grammar.
    func appearFade() -> some View {
        modifier(AppearFade())
    }

    /// The app's solid card surface: a slightly translucent secondary fill so
    /// the atmospheric wash shows faintly through, a hairline border, and a
    /// soft layered shadow (the design's shadow-lg). Data-dense, never glass.
    func cardSurface(radius: CGFloat = 14) -> some View {
        self
            .background(Theme.bgSecondary.opacity(0.82), in: RoundedRectangle(cornerRadius: radius))
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(Theme.borderPrimary, lineWidth: 1))
            .shadow(color: .black.opacity(0.22), radius: 14, y: 5)
    }
}

/// Fades and settles content in on first appearance.
struct AppearFade: ViewModifier {
    @State private var shown = false
    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 8)
            .onAppear {
                withAnimation(.easeOut(duration: 0.35)) { shown = true }
            }
    }
}

/// A faint procedural noise fill (Canvas of scattered specks), the app's stand-in
/// for the web's feTurbulence overlay. Deterministic, drawn once.
struct Noise: View {
    var body: some View {
        Canvas { ctx, size in
            var seed: UInt64 = 0x9E3779B97F4A7C15
            func rnd() -> Double {
                seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17
                return Double(seed % 10000) / 10000
            }
            let count = Int(size.width * size.height / 900)
            for _ in 0..<count {
                let x = rnd() * size.width
                let y = rnd() * size.height
                let a = 0.5 + rnd() * 0.5
                ctx.fill(
                    Path(ellipseIn: CGRect(x: x, y: y, width: 1, height: 1)),
                    with: .color(.white.opacity(a))
                )
            }
        }
        .allowsHitTesting(false)
    }
}
