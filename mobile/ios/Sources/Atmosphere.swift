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
/// and text read cleanly over it. Matches the web's auth hero.
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
            }
            .ignoresSafeArea()
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
