import SwiftUI

/// The unlocked home: content over a styled bottom navigation bar. The
/// header carries the current tree name (a menu to switch when there are
/// several) and quick access to settings and the lock.
struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    let entries: [AppModel.Entry]

    @State private var showSettings = false
    @ObservedObject private var loc = Loc.shared

    var body: some View {
        VStack(spacing: 0) {
            header

            Group {
                switch model.activeTab {
                case .journal:
                    JournalListView(entries: entries)
                case .tree:
                    treeTab
                }
            }
            .frame(maxHeight: .infinity)

            navBar
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
        #if DEBUG
        .onAppear { if model.debugOpenSettings { showSettings = true } }
        #endif
    }

    private var header: some View {
        HStack(spacing: 10) {
            if model.trees.count > 1 {
                // Back to the tree list, since the tree is the top context.
                Button {
                    model.showTreeList()
                } label: {
                    HStack(spacing: 6) {
                        LucideChevronLeft()
                            .stroke(Theme.textMuted, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                            .frame(width: 7, height: 12)
                        Text(currentTreeName)
                            .font(Theme.body(14, weight: .semibold))
                            .foregroundStyle(Theme.textPrimary)
                    }
                }
            } else {
                Text(currentTreeName)
                    .font(Theme.body(14, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
            }
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var treeTab: some View {
        if let tree = model.treeData, !tree.persons.isEmpty {
            TreeCanvasView(data: tree)
        } else {
            VStack {
                Spacer()
                Text(t("No tree yet. Trees grow at the desk; this canvas shows yours read-only."))
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Spacer()
            }
        }
    }

    private var navBar: some View {
        HStack(spacing: 0) {
            NavItem(icon: .bookOpen, label: t("Journal"), selected: model.activeTab == .journal) {
                model.activeTab = .journal
            }
            NavItem(icon: .network, label: t("Tree"), selected: model.activeTab == .tree) {
                model.activeTab = .tree
            }
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

    private var currentTreeName: String {
        model.trees.first { $0.id == model.selectedTreeId }?.name ?? "Traumatrees"
    }
}

/// A left-facing chevron in Lucide's grammar for the back-to-trees control.
struct LucideChevronLeft: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        return path
    }
}
