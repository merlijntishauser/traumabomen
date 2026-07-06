import SwiftUI

/// The distraction-free composer. Saving is quiet: encrypt, queue, push if
/// the network allows; the entry appears in the list either way.
struct ComposerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var content = ""
    @State private var saving = false

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Button("Cancel") { dismiss() }
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textMuted)
                    Spacer()
                    Button(action: save) {
                        Text(saving ? "Saving" : "Save")
                            .font(.system(size: Theme.bodySize, weight: .semibold))
                            .foregroundStyle(canSave ? Theme.accent : Theme.textMuted)
                    }
                    .disabled(!canSave || saving)
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)

                TextField("Title", text: $title)
                    .font(.system(size: 22, weight: .light))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 24)

                TextEditor(text: $content)
                    .scrollContentBackground(.hidden)
                    .font(.system(size: Theme.bodySize))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 19)
                    .overlay(alignment: .topLeading) {
                        if content.isEmpty {
                            Text("What was never spoken about, but everyone knew?")
                                .font(.system(size: Theme.bodySize))
                                .foregroundStyle(Theme.textMuted.opacity(0.6))
                                .padding(.horizontal, 24)
                                .padding(.top, 8)
                                .allowsHitTesting(false)
                        }
                    }

                Spacer()
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            || !content.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func save() {
        guard canSave, !saving else { return }
        saving = true
        let (t, c) = (title, content)
        Task {
            await model.createEntry(title: t, content: c)
            dismiss()
        }
    }
}
