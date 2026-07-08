import SwiftUI

/// The distraction-free composer, for a new entry or an existing one. A
/// single text field (like the web), an optional set of links to moments in
/// the tree, and quiet save. Editing an entry also offers delete.
struct ComposerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    /// nil = new entry; otherwise the entry being edited.
    let editing: AppModel.Entry?

    @State private var text: String
    @State private var links: [AppModel.LinkRef]
    @State private var showLinkPicker = false
    @State private var confirmingDelete = false
    @State private var saving = false

    init(editing: AppModel.Entry? = nil) {
        self.editing = editing
        _text = State(initialValue: editing?.text ?? "")
        _links = State(initialValue: editing?.links ?? [])
    }

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 14) {
                header

                TextEditor(text: $text)
                    .scrollContentBackground(.hidden)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.horizontal, 19)
                    .frame(minHeight: 160)
                    .overlay(alignment: .topLeading) {
                        if text.isEmpty {
                            Text(t("What was never spoken about, but everyone knew?"))
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

    private var header: some View {
        HStack {
            Button(t("Cancel")) { dismiss() }
                .font(Theme.body(13))
                .foregroundStyle(Theme.textMuted)
            Spacer()
            if editing != nil {
                Button(t(confirmingDelete ? "Confirm delete" : "Delete")) {
                    if confirmingDelete { delete() } else { confirmingDelete = true }
                }
                .font(Theme.body(13))
                .foregroundStyle(Theme.danger)
                .padding(.trailing, 12)
            }
            Button(action: save) {
                Text(t(saving ? "Saving" : "Save"))
                    .font(Theme.body(Theme.bodySize, weight: .semibold))
                    .foregroundStyle(canSave ? Theme.action : Theme.textMuted)
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
                Button(t(links.isEmpty ? "Link an item" : "Edit links")) {
                    showLinkPicker = true
                }
                .font(Theme.body(13))
                .foregroundStyle(Theme.action)
                .disabled(model.linkTargets.isEmpty)
            }
            if links.isEmpty {
                Text(model.linkTargets.isEmpty
                    ? "This tree has nothing to link yet."
                    : "Tie this entry to a person, turning point, or event in the tree.")
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(links, id: \.entityId) { ref in
                        HStack(spacing: 6) {
                            Circle().fill(Theme.linkColor(ref.entityType)).frame(width: 6, height: 6)
                            Text(model.linkTitle(ref) ?? "Unknown")
                                .font(Theme.body(13))
                                .foregroundStyle(Theme.textPrimary)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 24)
    }

    private var canSave: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    private func save() {
        guard canSave, !saving else { return }
        saving = true
        let (t, l) = (text.trimmingCharacters(in: .whitespacesAndNewlines), links)
        Task {
            if let entry = editing {
                await model.updateEntry(id: entry.id, text: t, links: l)
            } else {
                await model.createEntry(text: t, links: l)
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
            Theme.bgPrimary.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(t("Link an item"))
                        .font(Theme.heading(19))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Button(t("Done")) { dismiss() }
                        .font(Theme.body(Theme.bodySize, weight: .semibold))
                        .foregroundStyle(Theme.action)
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
