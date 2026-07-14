import SwiftUI

/// The app's home once unlocked: a warm forest-photo banner (the welcome
/// screen's greeting brought into everyday use), then the trees you hold keys
/// for. The selected tree is the top-level context, since both the journal and
/// the canvas belong to it, so choosing one is an explicit step (mirroring the
/// web's tree list). A single tree opens directly and never lands here.
struct TreeListView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared
    @State private var showSettings = false

    var body: some View {
        ZStack {
            AppBackground()
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        heroBanner

                        Text(t("Welcome back."))
                            .font(Theme.heading(26))
                            .foregroundStyle(Theme.textPrimary)
                            .padding(.horizontal, 24)

                        Text(t("Each tree holds its own family, journal, and canvas."))
                            .font(Theme.body(13))
                            .foregroundStyle(Theme.textMuted)
                            .padding(.horizontal, 24)
                            .padding(.top, 3)

                        LazyVStack(spacing: 12) {
                            ForEach(model.trees) { tree in
                                Button {
                                    Task { await model.enterTree(tree.id) }
                                } label: {
                                    treeCard(tree)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 20)
                        .padding(.bottom, 28)
                    }
                }
                // Let the hero bleed up under the status bar for an immersive
                // top; the banner is grown by the status-bar height to match.
                .ignoresSafeArea(edges: .top)

                // The same menu-bar grammar as inside a tree: Settings and Lock
                // are always reachable, here without the Journal/Tree tabs.
                menuBar
            }
            .appearFade()
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
    }

    /// A forest-photo banner with the wordmark over it, drifting ambient light,
    /// fading into the page. Full-bleed; the same warm greeting as the welcome
    /// screen, now the everyday home.
    private var heroBanner: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { proxy in
                Image("welcome")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: 260)
                    .clipped()
                    .overlay(
                        LinearGradient(
                            colors: [Theme.bgPrimary.opacity(0.15), .clear, Theme.bgPrimary],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .overlay(AmbientMotes())
            }
            .frame(height: 260)

            Text(t("Traumatrees"))
                .font(Theme.heading(32))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.5), radius: 8, y: 2)
                .padding(.bottom, 10)
        }
        .frame(height: 260)
        .padding(.bottom, 4)
    }

    private var menuBar: some View {
        HStack(spacing: 0) {
            NavItem(icon: .settings, label: t("Settings")) { showSettings = true }
            NavItem(icon: .lock, label: t("Lock")) { model.lock() }
        }
        .padding(.top, 10)
        .padding(.bottom, 4)
        .background(
            Theme.bgSecondary
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.borderPrimary).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func treeCard(_ tree: AppModel.TreeChoice) -> some View {
        HStack(spacing: 16) {
            LucideIcon.network.image
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .foregroundStyle(Theme.action)
                .frame(width: 44, height: 44)
                .background(Theme.action.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(tree.name)
                    .font(Theme.heading(19))
                    .foregroundStyle(Theme.textPrimary)
                Text(subtitle(tree))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
            }
            Spacer()
            LucideChevronRight()
                .stroke(Theme.textMuted, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                .frame(width: 7, height: 12)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface(radius: 16)
    }

    private func subtitle(_ tree: AppModel.TreeChoice) -> String {
        return "\(Plural.people(tree.personCount)), \(Plural.moments(tree.momentCount)), \(Plural.journalEntries(tree.journalCount))"
    }
}

/// A right-facing chevron in Lucide's grammar.
struct LucideChevronRight: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        return path
    }
}
