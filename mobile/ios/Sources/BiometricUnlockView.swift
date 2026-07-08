import SwiftUI

/// The daily unlock: Face ID releases the Enclave-wrapped key. The passphrase
/// path stays one tap away, and takes over automatically after 7 days or when
/// the wrap is invalidated. Framed by the forest-cabin hero.
struct BiometricUnlockView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared

    var body: some View {
        ZStack {
            HeroBackground()
            CenteredScroll {
                VStack(spacing: 20) {
                    Spacer(minLength: 40)

                    AuthWordmark(tagline: t("Welcome back."))

                    GlassCard {
                        VStack(spacing: 14) {
                            Button {
                                Task { await model.biometricUnlock() }
                            } label: {
                                HStack(spacing: 8) {
                                    FaceIDMark().stroke(.white, lineWidth: 1.6)
                                        .frame(width: 18, height: 18)
                                    Text(t("Unlock with Face ID"))
                                        .font(Theme.body(Theme.bodySize, weight: .semibold))
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .frame(height: 46)
                            .background(Theme.action, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)

                            Button {
                                Task { await model.usePassphraseInstead() }
                            } label: {
                                Text(t("Use passphrase instead"))
                                    .font(Theme.body(13))
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                    .padding(.horizontal, 28)

                    Spacer(minLength: 40)
                }
            }
        }
    }
}

/// A minimal Face ID mark (rounded square with corner ticks) in Lucide's
/// grammar, for the unlock button.
struct FaceIDMark: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let inset: CGFloat = rect.width * 0.16
        // Four corner brackets.
        let r = rect.insetBy(dx: 1, dy: 1)
        let len = rect.width * 0.22
        // top-left
        p.move(to: CGPoint(x: r.minX, y: r.minY + len)); p.addLine(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.minX + len, y: r.minY))
        // top-right
        p.move(to: CGPoint(x: r.maxX - len, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY + len))
        // bottom-left
        p.move(to: CGPoint(x: r.minX, y: r.maxY - len)); p.addLine(to: CGPoint(x: r.minX, y: r.maxY)); p.addLine(to: CGPoint(x: r.minX + len, y: r.maxY))
        // bottom-right
        p.move(to: CGPoint(x: r.maxX - len, y: r.maxY)); p.addLine(to: CGPoint(x: r.maxX, y: r.maxY)); p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - len))
        // eyes + nose
        p.move(to: CGPoint(x: r.minX + inset * 2, y: r.midY - inset)); p.addLine(to: CGPoint(x: r.minX + inset * 2, y: r.midY - inset * 0.2))
        p.move(to: CGPoint(x: r.maxX - inset * 2, y: r.midY - inset)); p.addLine(to: CGPoint(x: r.maxX - inset * 2, y: r.midY - inset * 0.2))
        p.move(to: CGPoint(x: r.midX - inset, y: r.maxY - inset * 2)); p.addLine(to: CGPoint(x: r.midX + inset, y: r.maxY - inset * 2))
        return p
    }
}
