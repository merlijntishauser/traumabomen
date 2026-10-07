import SwiftUI

/// The app's home once unlocked, as the web's tree list threshold: it opens
/// on your family (the latest tree as a silhouette of its own canvas), then
/// the other trees you hold keys for. The selected tree is the top-level context, since both the journal and
/// the canvas belong to it, so choosing one is an explicit step (mirroring the
/// web's tree list). A single tree opens directly and never lands here.
struct TreeListView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject private var loc = Loc.shared
    @State private var showSettings = false
    @State private var naming = false
    @State private var newTreeName = ""

    @State private var questionIndex = Int.random(in: 0..<JournalPrompts.count)

    var body: some View {
        ZStack {
            AppBackground()
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(t("Traumatrees"))
                            .font(Theme.heading(20))
                            .fontWeight(.light)
                            .foregroundStyle(Theme.textPrimary)
                            .padding(.horizontal, 24)
                            .padding(.top, 12)

                        if let latest = latestTree {
                            threshold(latest).padding(.top, 18)
                        }

                        let others = model.trees.filter { $0.id != latestTree?.id }
                        if !others.isEmpty {
                            Text(t("Other trees"))
                                .font(Theme.heading(16))
                                .fontWeight(.light)
                                .foregroundStyle(Theme.textMuted)
                                .padding(.horizontal, 24)
                                .padding(.top, 34)
                                .accessibilityAddTraits(.isHeader)
                            VStack(spacing: 0) {
                                ForEach(others) { tree in
                                    Button {
                                        Task { await model.enterTree(tree.id) }
                                    } label: {
                                        treeRow(tree)
                                    }
                                    .buttonStyle(.plain)
                                    Rectangle().fill(Theme.borderPrimary).frame(height: 1)
                                }
                            }
                            .padding(.horizontal, 24)
                            .padding(.top, 6)
                        }

                        newTreeRow
                            .padding(.horizontal, 24)
                            .padding(.top, 26)
                            .padding(.bottom, 28)
                    }
                }

                // The same menu-bar grammar as inside a tree: Settings and Lock
                // are always reachable, here without the Journal/Tree tabs.
                menuBar
            }
            .appearFade()
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .task(id: model.latestTreeId) { await model.loadPreview() }
    }

    private var latestTree: AppModel.TreeChoice? {
        model.latestTreeId.flatMap { id in model.trees.first { $0.id == id } }
    }

    /// The page opens on your family: the latest tree's own layout in
    /// miniature, its name, one open question, and the way in.
    private func threshold(_ tree: AppModel.TreeChoice) -> some View {
        let preview = model.previewTree
        let empty = preview.map { $0.persons.isEmpty } ?? (tree.personCount == 0)
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                Task { await model.enterTree(tree.id) }
            } label: {
                Group {
                    if empty {
                        VStack(spacing: 10) {
                            Text(t("Start with yourself"))
                                .font(Theme.heading(18))
                                .fontWeight(.light)
                                .foregroundStyle(Theme.textPrimary)
                            Text(t("Nobody is in this tree yet. You could begin with yourself, then the people you grew up with."))
                                .font(Theme.body(13))
                                .foregroundStyle(Theme.textMuted)
                                .multilineTextAlignment(.center)
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, minHeight: 200)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Theme.borderPrimary, style: StrokeStyle(lineWidth: 1.5, dash: [6, 5]))
                        )
                    } else if let preview {
                        SilhouetteView(silhouette: Silhouette(persons: preview.persons, edges: preview.edges))
                            .padding(14)
                            .frame(maxWidth: .infinity)
                            .frame(height: 230)
                            .background(Theme.bgSecondary.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.borderPrimary, lineWidth: 1))
                    } else {
                        Color.clear.frame(height: 230)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tf("Open {name}", ["name": tree.name]))

            Text(tree.name)
                .font(Theme.heading(30))
                .fontWeight(.ultraLight)
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 20)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle(tree))
                .font(Theme.body(13))
                .foregroundStyle(Theme.textMuted)
                .padding(.top, 4)

            Rectangle().fill(Theme.borderPrimary).frame(height: 1)
                .padding(.vertical, 18)

            Text(JournalPrompts.journal(questionIndex))
                .font(Theme.heading(17))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 22) {
                Button {
                    Task { await model.enterTree(tree.id) }
                } label: {
                    Text(t("Open tree"))
                        .font(Theme.body(Theme.bodySize, weight: .semibold))
                        .foregroundStyle(Theme.bgPrimary)
                        .padding(.horizontal, 20)
                        .frame(minHeight: 44)
                        .background(Theme.action, in: RoundedRectangle(cornerRadius: 8))
                }
                Button {
                    Task { await model.writeAbout(tree.id) }
                } label: {
                    Text(t("Write about it"))
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.action)
                        .frame(minHeight: 44)
                }
            }
            .padding(.top, 18)
        }
        .padding(.horizontal, 24)
    }

    private func treeRow(_ tree: AppModel.TreeChoice) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(tree.name)
                    .font(Theme.heading(17))
                    .fontWeight(.light)
                    .foregroundStyle(Theme.textPrimary)
                Text(subtitle(tree))
                    .font(Theme.body(12))
                    .foregroundStyle(Theme.textMuted)
            }
            Spacer()
            LucideChevronRight()
                .stroke(Theme.textMuted, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                .frame(width: 7, height: 12)
        }
        .padding(.vertical, 14)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    /// Start a tree. Named up front because the name is the only thing a tree
    /// carries until people are added to it, and an unnamed one reads as a bug.
    @ViewBuilder private var newTreeRow: some View {
        if naming {
            VStack(alignment: .leading, spacing: 10) {
                TextField(t("Tree name"), text: $newTreeName)
                    .modifier(FieldStyle())
                    .submitLabel(.done)
                    .onSubmit(create)

                if let error = model.errorMessage {
                    Text(error)
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.danger)
                }

                HStack(spacing: 16) {
                    Button {
                        naming = false
                        newTreeName = ""
                    } label: {
                        Text(t("Cancel"))
                            .font(Theme.body(Theme.bodySize))
                            .foregroundStyle(Theme.textMuted)
                    }

                    Button(action: create) {
                        Text(t("Create tree"))
                            .font(Theme.body(Theme.bodySize, weight: .semibold))
                            .foregroundStyle(Theme.action)
                    }
                    .disabled(newTreeName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardSurface(radius: 16)
        } else {
            Button {
                model.errorMessage = nil
                naming = true
            } label: {
                Text(model.trees.isEmpty ? t("Create your first tree") : t("Start a new tree"))
                    .font(Theme.body(Theme.bodySize, weight: .semibold))
                    .foregroundStyle(Theme.action)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .cardSurface(radius: 16)
            }
            .buttonStyle(.plain)
        }
    }

    private func create() {
        let name = newTreeName
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        naming = false
        newTreeName = ""
        Task { await model.createTree(name: name) }
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
