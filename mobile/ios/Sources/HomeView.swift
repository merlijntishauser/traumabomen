import SwiftUI

/// The unlocked home: a quiet two-tab shell over the journal and the
/// read-only tree, with the lock always one tap away.
struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    let entries: [AppModel.Entry]

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 20) {
                tabButton("Journal", tab: .journal)
                tabButton("Tree", tab: .tree)
                Spacer()
                Button("Lock") { model.lock() }
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 4)

            switch model.activeTab {
            case .journal:
                JournalListView(entries: entries)
            case .tree:
                if let tree = model.treeData, !tree.persons.isEmpty {
                    TreeCanvasView(data: tree)
                } else {
                    Spacer()
                    Text("No tree yet. Trees grow at the desk; this canvas shows yours read-only.")
                        .font(.system(size: Theme.bodySize))
                        .foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                    Spacer()
                }
            }
        }
    }

    private func tabButton(_ label: String, tab: AppModel.Tab) -> some View {
        Button(label) { model.activeTab = tab }
            .font(.system(size: 15, weight: model.activeTab == tab ? .semibold : .regular))
            .foregroundStyle(model.activeTab == tab ? Theme.textPrimary : Theme.textMuted)
    }
}
