import SwiftUI

/// The reflective heart of the companion: journal entries, decrypted in
/// memory, presented quietly. The sync state is one muted line, never a
/// spinner takeover.
struct JournalListView: View {
    @EnvironmentObject private var model: AppModel
    let entries: [AppModel.Entry]

    @State private var composing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text("Journal")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Button("New entry") { composing = true }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.accent)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            Text(statusLine)
                .font(.system(size: 13))
                .foregroundStyle(Theme.textMuted)
                .padding(.horizontal, 24)
                .padding(.top, 2)

            if entries.isEmpty {
                Spacer()
                Text("Nothing here yet. Your first entry can be a single sentence.")
                    .font(.system(size: Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(entries) { entry in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(entry.title)
                                        .font(.system(size: 17, weight: .light))
                                        .foregroundStyle(Theme.textPrimary)
                                    if entry.pending {
                                        Text("waiting to sync")
                                            .font(.system(size: 11))
                                            .foregroundStyle(Theme.textMuted)
                                    }
                                }
                                Text(entry.content)
                                    .font(.system(size: Theme.bodySize))
                                    .foregroundStyle(Theme.textMuted)
                                    .lineLimit(3)
                            }
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Theme.borderPrimary, lineWidth: 1)
                            )
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
    }

    private var statusLine: String {
        let count = entries.count == 1 ? "1 entry" : "\(entries.count) entries"
        let pending = model.pendingSyncCount
        return pending > 0 ? "\(count); \(pending) waiting to sync" : count
    }
}
