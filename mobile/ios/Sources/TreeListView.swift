import SwiftUI

/// The app's home once unlocked: the trees you hold keys for. The selected
/// tree is the top-level context, since both the journal and the canvas
/// belong to it, so choosing one is an explicit step (mirroring the web's
/// tree list). A single tree opens directly and never lands here.
struct TreeListView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Your trees")
                        .font(Theme.heading(26))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Button("Lock") { model.lock() }
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)

                Text("Each tree holds its own family, journal, and canvas.")
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
            }
        }
    }

    private func treeCard(_ tree: AppModel.TreeChoice) -> some View {
        HStack(spacing: 16) {
            LucideIcon.network.image
                .resizable()
                .scaledToFit()
                .frame(width: 24, height: 24)
                .foregroundStyle(Theme.action)

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
        .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.borderPrimary, lineWidth: 1))
    }

    private func subtitle(_ tree: AppModel.TreeChoice) -> String {
        let people = tree.personCount == 1 ? "1 person" : "\(tree.personCount) people"
        let moments = tree.momentCount == 1 ? "1 moment" : "\(tree.momentCount) moments"
        let entries = tree.journalCount == 1 ? "1 journal entry" : "\(tree.journalCount) journal entries"
        return "\(people), \(moments), \(entries)"
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
