import SwiftUI

/// The reflective heart of the companion: journal entries, decrypted in
/// memory, presented quietly. Composing and turning-point links follow in
/// later slices.
struct JournalListView: View {
    @EnvironmentObject private var model: AppModel
    let entries: [AppModel.Entry]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("Journal")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Button("Lock") { model.lock() }
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)

            Text(entries.count == 1 ? "1 entry" : "\(entries.count) entries")
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
                                Text(entry.title)
                                    .font(.system(size: 17, weight: .light))
                                    .foregroundStyle(Theme.textPrimary)
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
    }
}
