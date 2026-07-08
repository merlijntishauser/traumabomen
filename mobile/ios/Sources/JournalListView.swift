import SwiftUI

/// The reflective heart of the companion: journal entries, decrypted in
/// memory, presented quietly. The sync state is one muted line, never a
/// spinner takeover.
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
                Button(t("New entry")) { composing = true }
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.action)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            Text(statusLine)
                .font(Theme.body(13))
                .foregroundStyle(Theme.textMuted)
                .padding(.horizontal, 24)
                .padding(.top, 2)

            if entries.isEmpty {
                Spacer()
                Text(t("Nothing here yet. Your first entry can be a single sentence."))
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(entries) { entry in
                            Button { editingEntry = entry } label: {
                                entryCard(entry)
                            }
                            .buttonStyle(.plain)
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
                    .font(Theme.body(17, weight: .light))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                if entry.pending {
                    Text(t("waiting to sync"))
                        .font(Theme.body(11))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            if !entry.body.isEmpty {
                Text(entry.body)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
                    .lineLimit(3)
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
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }

    private var statusLine: String {
        let count = Plural.entries(entries.count)
        let pending = model.pendingSyncCount
        return pending > 0 ? "\(count); \(pending) \(t("waiting to sync"))" : count
    }
}
