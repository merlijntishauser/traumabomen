import SwiftUI

/// The reflective heart of the companion, as the web's writing desk: a way
/// in to a new entry (which opens on one open question), then a margin of
/// earlier entries, newest first. Decrypted in memory, presented quietly; the
/// sync state is one muted line, never a spinner takeover.
struct JournalListView: View {
    @EnvironmentObject private var model: AppModel
    let entries: [AppModel.Entry]

    @State private var composing = false
    @State private var editingEntry: AppModel.Entry?
    @ObservedObject private var loc = Loc.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text(t("Journal"))
                    .font(Theme.heading(20))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Button { composing = true } label: {
                    ActionLabel(mark: LucidePlus(), text: t("New entry"), color: Theme.action, markSize: 11)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            HStack(spacing: 8) {
                Text(statusLine)
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
                if model.savedWhisper {
                    Text(t("Saved"))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.action)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: model.savedWhisper)
            .padding(.horizontal, 24)
            .padding(.top, 2)

            if entries.isEmpty {
                Spacer()
                Text(t("What you write appears here, newest first. Only you can read it."))
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        Text(t("Earlier entries"))
                            .font(Theme.heading(16))
                            .fontWeight(.light)
                            .foregroundStyle(Theme.textMuted)
                            .padding(.bottom, 6)
                            .accessibilityAddTraits(.isHeader)
                        ForEach(entries) { entry in
                            Button { editingEntry = entry } label: {
                                entryCard(entry)
                            }
                            .buttonStyle(.plain)
                            Rectangle().fill(Theme.borderPrimary).frame(height: 1)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                }
            }
        }
        .sheet(isPresented: $composing) {
            ComposerView().environmentObject(model)
        }
        .onAppear {
            // "Write about it" from the tree list lands straight in a new entry.
            if model.composeOnOpen {
                model.composeOnOpen = false
                composing = true
            }
        }
        #if DEBUG
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("-openComposer") { composing = true }
        }
        #endif
        .sheet(item: $editingEntry) { entry in
            ComposerView(editing: entry).environmentObject(model)
        }
    }

    private func entryCard(_ entry: AppModel.Entry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.title)
                    .font(Theme.heading(16))
                    .fontWeight(.light)
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if entry.pending {
                    Text(t("waiting to sync"))
                        .font(Theme.body(11))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            if !excerpt(entry.body).isEmpty {
                Text(excerpt(entry.body))
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textSecondary)
                    .lineSpacing(3)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }

            if !entry.links.isEmpty {
                HStack(spacing: 10) {
                    ForEach(entry.links.prefix(3), id: \.entityId) { ref in
                        HStack(spacing: 5) {
                            Circle().fill(Theme.linkColor(ref.entityType)).frame(width: 5, height: 5)
                            Text(model.linkTitle(ref) ?? t("Unknown"))
                                .font(Theme.body(12))
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                    if entry.links.count > 3 {
                        Text("+\(entry.links.count - 3)")
                            .font(Theme.body(12))
                            .foregroundStyle(Theme.textMuted)
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    /// Plain text for the margin: quoted questions and markdown marks fall away.
    private func excerpt(_ body: String) -> String {
        body.components(separatedBy: "\n")
            .filter { !$0.trimmingCharacters(in: .whitespaces).hasPrefix(">") }
            .map { $0.replacingOccurrences(of: "*", with: "").replacingOccurrences(of: "#", with: "") }
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var statusLine: String {
        let count = Plural.entries(entries.count)
        let pending = model.pendingSyncCount
        return pending > 0 ? "\(count); \(pending) \(t("waiting to sync"))" : count
    }
}
