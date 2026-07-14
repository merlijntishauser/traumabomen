import SwiftUI

/// A modal form for a reflective-layer entity: a header with cancel / save, a
/// scroll of fields, and (when editing) a delete. Matches the app's custom
/// sheet grammar rather than a navigation bar. Save is disabled until valid;
/// the async write happens in the model and the sheet dismisses.
struct EntityFormScaffold<Content: View>: View {
    let title: String
    let canSave: Bool
    let onSave: () -> Void
    let onDelete: (() -> Void)?
    @ViewBuilder var content: Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            AppBackground()
            VStack(spacing: 0) {
                HStack {
                    Button { dismiss() } label: {
                        ActionLabel(
                            mark: LucideX(), text: t("Cancel"),
                            color: Theme.textSecondary, font: Theme.body(Theme.bodySize), markSize: 12
                        )
                    }
                    Spacer()
                    Text(title)
                        .font(Theme.heading(18))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Button { onSave(); dismiss() } label: {
                        ActionLabel(
                            mark: LucideCheck(), text: t("Save"),
                            color: canSave ? Theme.action : Theme.textMuted,
                            font: Theme.body(Theme.bodySize, weight: .semibold)
                        )
                    }
                    .disabled(!canSave)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                Rectangle().fill(Theme.borderPrimary).frame(height: 0.5)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        content
                        if let onDelete {
                            Button { onDelete(); dismiss() } label: {
                                ActionLabel(
                                    mark: LucideTrash(), text: t("Delete"),
                                    color: Theme.danger,
                                    font: Theme.body(Theme.bodySize, weight: .semibold), markSize: 15
                                )
                            }
                            .padding(.top, 8)
                        }
                    }
                    .padding(20)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

/// A multi-line description field styled like the other inputs.
struct DescriptionField: View {
    let placeholder: String
    @Binding var text: String
    var body: some View {
        TextField(placeholder, text: $text, axis: .vertical)
            .lineLimit(3...6)
            .modifier(FieldStyle())
    }
}

struct TurningPointForm: View {
    @EnvironmentObject private var model: AppModel
    let editingId: String?
    let persons: [TreePerson]
    let defaultPersonId: String

    @State private var content = TurningPointContent()
    @State private var personIds: Set<String> = []
    @State private var loaded = false

    var body: some View {
        EntityFormScaffold(
            title: editingId == nil ? t("Add milestone") : t("Edit milestone"),
            canSave: !content.title.trimmingCharacters(in: .whitespaces).isEmpty && !personIds.isEmpty,
            onSave: {
                let (c, ids) = (content, Array(personIds))
                Task { await model.saveTurningPoint(id: editingId, content: c, personIds: ids) }
            },
            onDelete: editingId.map { id in
                { Task { await model.deleteStoryItem(type: .turningPoints, id: id) } }
            }
        ) {
            FormField(label: t("Title")) {
                TextField(t("Title"), text: $content.title).modifier(FieldStyle())
            }
            FormField(label: t("Category")) {
                TermMenu(terms: Taxonomies.turning, selection: $content.category)
            }
            FormField(label: t("When")) {
                TextField(t("Approximate date"), text: $content.approximate_date).modifier(FieldStyle())
            }
            FormField(label: t("Significance")) {
                ScaleDots(value: $content.significance)
            }
            FormField(label: t("Description")) {
                DescriptionField(placeholder: t("Description"), text: $content.description)
            }
            FormField(label: t("Tags")) {
                TagField(tags: $content.tags)
            }
            FormField(label: t("Attached to")) {
                PersonMultiPicker(persons: persons, selected: $personIds)
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard !loaded else { return }
        if let editingId,
           let result: (content: TurningPointContent, personIds: [String]) =
               await model.loadEntityContent(type: .turningPoints, id: editingId) {
            content = result.content
            personIds = Set(result.personIds)
        } else {
            personIds = [defaultPersonId]
        }
        loaded = true
    }
}

struct TraumaEventForm: View {
    @EnvironmentObject private var model: AppModel
    let editingId: String?
    let persons: [TreePerson]
    let defaultPersonId: String

    @State private var content = TraumaEventContent()
    @State private var personIds: Set<String> = []
    @State private var loaded = false

    var body: some View {
        EntityFormScaffold(
            title: editingId == nil ? t("Add trauma event") : t("Edit trauma event"),
            canSave: !content.title.trimmingCharacters(in: .whitespaces).isEmpty && !personIds.isEmpty,
            onSave: {
                let (c, ids) = (content, Array(personIds))
                Task { await model.saveTraumaEvent(id: editingId, content: c, personIds: ids) }
            },
            onDelete: editingId.map { id in
                { Task { await model.deleteStoryItem(type: .traumaEvents, id: id) } }
            }
        ) {
            FormField(label: t("Title")) {
                TextField(t("Title"), text: $content.title).modifier(FieldStyle())
            }
            FormField(label: t("Category")) {
                TermMenu(terms: Taxonomies.trauma, selection: $content.category)
            }
            FormField(label: t("When")) {
                TextField(t("Approximate date"), text: $content.approximate_date).modifier(FieldStyle())
            }
            FormField(label: t("Severity")) {
                // Severity is always set; a tap on the current value keeps it.
                ScaleDots(value: Binding(
                    get: { content.severity },
                    set: { content.severity = $0 ?? content.severity }
                ))
            }
            FormField(label: t("Description")) {
                DescriptionField(placeholder: t("Description"), text: $content.description)
            }
            FormField(label: t("Tags")) {
                TagField(tags: $content.tags)
            }
            FormField(label: t("Attached to")) {
                PersonMultiPicker(persons: persons, selected: $personIds)
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard !loaded else { return }
        if let editingId,
           let result: (content: TraumaEventContent, personIds: [String]) =
               await model.loadEntityContent(type: .traumaEvents, id: editingId) {
            content = result.content
            personIds = Set(result.personIds)
        } else {
            personIds = [defaultPersonId]
        }
        loaded = true
    }
}

struct LifeEventForm: View {
    @EnvironmentObject private var model: AppModel
    let editingId: String?
    let persons: [TreePerson]
    let defaultPersonId: String

    @State private var content = LifeEventContent()
    @State private var personIds: Set<String> = []
    @State private var loaded = false

    var body: some View {
        EntityFormScaffold(
            title: editingId == nil ? t("Add life event") : t("Edit life event"),
            canSave: !content.title.trimmingCharacters(in: .whitespaces).isEmpty && !personIds.isEmpty,
            onSave: {
                let (c, ids) = (content, Array(personIds))
                Task { await model.saveLifeEvent(id: editingId, content: c, personIds: ids) }
            },
            onDelete: editingId.map { id in
                { Task { await model.deleteStoryItem(type: .lifeEvents, id: id) } }
            }
        ) {
            FormField(label: t("Title")) {
                TextField(t("Title"), text: $content.title).modifier(FieldStyle())
            }
            FormField(label: t("Category")) {
                TermMenu(terms: Taxonomies.life, selection: $content.category)
            }
            FormField(label: t("When")) {
                TextField(t("Approximate date"), text: $content.approximate_date).modifier(FieldStyle())
            }
            FormField(label: t("Impact")) {
                ScaleDots(value: $content.impact)
            }
            FormField(label: t("Description")) {
                DescriptionField(placeholder: t("Description"), text: $content.description)
            }
            FormField(label: t("Tags")) {
                TagField(tags: $content.tags)
            }
            FormField(label: t("Attached to")) {
                PersonMultiPicker(persons: persons, selected: $personIds)
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard !loaded else { return }
        if let editingId,
           let result: (content: LifeEventContent, personIds: [String]) =
               await model.loadEntityContent(type: .lifeEvents, id: editingId) {
            content = result.content
            personIds = Set(result.personIds)
        } else {
            personIds = [defaultPersonId]
        }
        loaded = true
    }
}

struct ClassificationForm: View {
    @EnvironmentObject private var model: AppModel
    let editingId: String?
    let persons: [TreePerson]
    let defaultPersonId: String

    @State private var content = ClassificationContent()
    @State private var personIds: Set<String> = []
    @State private var loaded = false

    private let statusTerms = [
        Term("suspected", "Suspected", "Vermoed"),
        Term("diagnosed", "Diagnosed", "Gediagnosticeerd"),
    ]

    var body: some View {
        let subTerms = [Term("", "None", "Geen")]
            + (Taxonomies.dsmGroup(content.dsm_category)?.subcategories ?? [])
        EntityFormScaffold(
            title: editingId == nil ? t("Add classification") : t("Edit classification"),
            canSave: !content.dsm_category.isEmpty && !personIds.isEmpty,
            onSave: {
                let (c, ids) = (content, Array(personIds))
                Task { await model.saveClassification(id: editingId, content: c, personIds: ids) }
            },
            onDelete: editingId.map { id in
                { Task { await model.deleteStoryItem(type: .classifications, id: id) } }
            }
        ) {
            FormField(label: t("DSM category")) {
                // Setting a new category clears a now-mismatched subcategory.
                TermMenu(terms: Taxonomies.dsm.map(\.term), selection: Binding(
                    get: { content.dsm_category },
                    set: { content.dsm_category = $0; content.dsm_subcategory = nil }
                ))
            }
            FormField(label: t("Subcategory")) {
                TermMenu(terms: subTerms, selection: Binding(
                    get: { content.dsm_subcategory ?? "" },
                    set: { content.dsm_subcategory = $0.isEmpty ? nil : $0 }
                ))
            }
            FormField(label: t("Status")) {
                TermMenu(terms: statusTerms, selection: $content.status)
            }
            FormField(label: t("Diagnosis year")) {
                YearField(placeholder: t("Year"), year: $content.diagnosis_year)
            }
            FormField(label: t("Periods")) {
                PeriodEditor(periods: $content.periods)
            }
            FormField(label: t("Notes")) {
                DescriptionField(placeholder: t("Notes"), text: Binding(
                    get: { content.notes ?? "" },
                    set: { content.notes = $0.isEmpty ? nil : $0 }
                ))
            }
            FormField(label: t("Attached to")) {
                PersonMultiPicker(persons: persons, selected: $personIds)
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard !loaded else { return }
        if let editingId,
           let result: (content: ClassificationContent, personIds: [String]) =
               await model.loadEntityContent(type: .classifications, id: editingId) {
            content = result.content
            personIds = Set(result.personIds)
        } else {
            content.dsm_category = "anxiety"
            personIds = [defaultPersonId]
        }
        loaded = true
    }
}
