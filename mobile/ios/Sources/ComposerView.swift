import SwiftUI

/// The journal as a writing desk, for a new entry or an existing one. A new
/// entry opens on one open question in the voice face; answering it quotes
/// the question into the entry, so rereading shows the question apart from
/// the answer (as on the web). A single text field, optional links to moments
/// in the tree, and quiet save. Editing an entry also offers delete.
struct ComposerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    /// nil = new entry; otherwise the entry being edited.
    let editing: AppModel.Entry?

    @State private var title: String
    @State private var bodyText: String
    @State private var links: [AppModel.LinkRef]
    @State private var showLinkPicker = false
    @State private var confirmingDelete = false
    @State private var saving = false
    /// The open question offered to a new entry: a given one (about a person), or a journal prompt.
    @State private var question: String?
    @State private var promptIndex = Int.random(in: 0..<JournalPrompts.count)
    @FocusState private var bodyFocused: Bool

    init(editing: AppModel.Entry? = nil, presetLinks: [AppModel.LinkRef] = [], question: String? = nil) {
        self.editing = editing
        _title = State(initialValue: editing?.title ?? "")
        _bodyText = State(initialValue: editing?.body ?? "")
        _links = State(initialValue: editing?.links ?? presetLinks)
        _question = State(initialValue: question)
    }

    private var shownQuestion: String { question ?? JournalPrompts.journal(promptIndex) }

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: 12) {
                header

                if editing == nil { questionBlock }

                // Title: the first line, shown larger; it is what the list and
                // the web preview use as the entry's heading.
                TextField(t("A title"), text: $title, axis: .vertical)
                    .font(Theme.body(19, weight: .light))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1...2)
                    .padding(.horizontal, 24)

                Rectangle().fill(Theme.borderPrimary).frame(height: 1)
                    .padding(.horizontal, 24)

                // Body: everything else.
                TextEditor(text: $bodyText)
                    .scrollContentBackground(.hidden)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 19)
                    .frame(minHeight: 140)
                    .focused($bodyFocused)
                    .lineSpacing(5)
                    .overlay(alignment: .topLeading) {
                        if bodyText.isEmpty {
                            Text(t("Write your reflection here…"))
                                .font(Theme.body(Theme.bodySize))
                                .foregroundStyle(Theme.textMuted.opacity(0.6))
                                .padding(.horizontal, 24)
                                .padding(.top, 8)
                                .allowsHitTesting(false)
                        }
                    }

                linksSection

                Spacer()
            }
        }
        .preferredColorScheme(model.themeMode.colorScheme)
        .sheet(isPresented: $showLinkPicker) {
            LinkPickerView(selected: $links).environmentObject(model)
        }
    }

    /// One open question at the top of the sheet, with a way to answer it or ask another.
    private var questionBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(shownQuestion)
                .font(Theme.heading(20))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 20) {
                Button(action: answer) {
                    Text(t("Answer this question"))
                        .font(Theme.body(13, weight: .semibold))
                        .foregroundStyle(Theme.action)
                        .frame(minHeight: 44)
                }
                Button {
                    question = nil
                    promptIndex = JournalPrompts.another(after: promptIndex, count: JournalPrompts.count)
                } label: {
                    Text(t("Another question"))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                        .frame(minHeight: 44)
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    /// Put the question into the entry as a quote, so rereading shows it apart from the answer.
    private func answer() {
        let quote = "> " + shownQuestion
        if !bodyText.hasPrefix(quote) {
            bodyText = bodyText.isEmpty ? quote + "\n\n" : quote + "\n\n" + bodyText
        }
        bodyFocused = true
    }

    private var header: some View {
        HStack {
            Button { dismiss() } label: {
                ActionLabel(mark: LucideX(), text: t("Cancel"), color: Theme.textMuted, font: Theme.body(13), markSize: 11)
            }
            Spacer()
            if editing != nil {
                Button {
                    if confirmingDelete { delete() } else { confirmingDelete = true }
                } label: {
                    ActionLabel(
                        mark: LucideTrash(), text: t(confirmingDelete ? "Confirm delete" : "Delete"),
                        color: Theme.danger, font: Theme.body(13)
                    )
                }
                .padding(.trailing, 12)
            }
            Button(action: save) {
                ActionLabel(
                    mark: LucideCheck(), text: t(saving ? "Saving" : "Save"),
                    color: canSave ? Theme.action : Theme.textMuted,
                    font: Theme.body(Theme.bodySize, weight: .semibold)
                )
            }
            .disabled(!canSave || saving)
        }
        .padding(.horizontal, 24)
        .padding(.top, 16)
    }

    private var linksSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(t("Linked"))
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)
                Spacer()
                Button { showLinkPicker = true } label: {
                    ActionLabel(
                        mark: LucidePlus(), text: t(links.isEmpty ? "Link an item" : "Edit links"),
                        color: Theme.action, font: Theme.body(13), markSize: 11
                    )
                }
                .disabled(model.linkTargets.isEmpty)
            }
            if links.isEmpty {
                Text(t(model.linkTargets.isEmpty
                    ? "This tree has nothing to link yet."
                    : "Tie this entry to a person, turning point, or event in the tree."))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(links, id: \.entityId) { ref in
                        HStack(spacing: 6) {
                            Circle().fill(Theme.linkColor(ref.entityType)).frame(width: 6, height: 6)
                            Text(model.linkTitle(ref) ?? t("Unknown"))
                                .font(Theme.body(13))
                                .foregroundStyle(Theme.textPrimary)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 24)
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func save() {
        guard canSave, !saving else { return }
        saving = true
        let composed = AppModel.Entry.compose(title: title, body: bodyText)
        let l = links
        Task {
            if let entry = editing {
                await model.updateEntry(id: entry.id, text: composed, links: l)
            } else {
                await model.createEntry(text: composed, links: l)
            }
            dismiss()
        }
    }

    private func delete() {
        guard let entry = editing else { return }
        saving = true
        Task {
            await model.deleteEntry(id: entry.id)
            dismiss()
        }
    }
}

/// Pick which moments this entry links to, grouped by kind.
struct LinkPickerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @Binding var selected: [AppModel.LinkRef]

    private let groups: [(label: String, type: String)] = [
        ("People", "person"),
        ("Turning points", "turning_point"),
        ("Trauma events", "trauma_event"),
        ("Life events", "life_event"),
    ]

    var body: some View {
        ZStack {
            AppBackground()
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(t("Link an item"))
                        .font(Theme.heading(19))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Button { dismiss() } label: {
                        ActionLabel(mark: LucideCheck(), text: t("Done"), color: Theme.action, font: Theme.body(Theme.bodySize, weight: .semibold))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(groups, id: \.type) { group in
                            let items = model.linkTargets.filter { $0.entityType == group.type }
                            if !items.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(t(group.label))
                                        .font(Theme.body(13, weight: .semibold))
                                        .foregroundStyle(Theme.textMuted)
                                    ForEach(items) { item in
                                        row(item)
                                    }
                                }
                            }
                        }
                    }
                    .padding(24)
                }
            }
        }
        .preferredColorScheme(model.themeMode.colorScheme)
    }

    private func row(_ item: AppModel.LinkTarget) -> some View {
        let isSelected = selected.contains { $0.entityId == item.id }
        return Button {
            if isSelected {
                selected.removeAll { $0.entityId == item.id }
            } else {
                selected.append(.init(entityType: item.entityType, entityId: item.id))
            }
        } label: {
            HStack {
                Text(item.title)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                if isSelected {
                    Circle().fill(Theme.linkColor(item.entityType)).frame(width: 8, height: 8)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.bgSecondary, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                isSelected ? Theme.linkColor(item.entityType) : Theme.borderPrimary, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
