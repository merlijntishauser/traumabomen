import SwiftUI

/// The app's home once unlocked: the trees you hold keys for. The selected
/// tree is the top-level context, since both the journal and the canvas
/// belong to it, so choosing one is an explicit step (mirroring the web's
/// tree list). A single tree opens directly and never lands here.
struct TreeListView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared
    @State private var showSettings = false

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: 0) {
                Text(t("Your trees"))
                    .font(Theme.heading(26))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 24)
                    .padding(.top, 20)

                Text(t("Each tree holds its own family, journal, and canvas."))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.horizontal, 24)
                    .padding(.top, 2)

                ScrollView {
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
                    .padding(.vertical, 20)
                }

                // The same menu-bar grammar as inside a tree: Settings and Lock
                // are always reachable, here without the Journal/Tree tabs.
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
            .appearFade()
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
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
