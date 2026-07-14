import SwiftUI

/// Shared controls for the person-page edit forms: a taxonomy menu, a dot
/// scale, a tag editor, a year field, the classification period editor, and
/// the multi-person picker. Styled with the app tokens; icons are drawn in
/// Lucide's grammar (no SF Symbols).

/// A labeled field: a small muted caption above its control.
struct FormField<Content: View>: View {
    let label: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(Theme.body(12, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
            content
        }
    }
}

/// A menu picking one Term from a taxonomy, storing its stable key and showing
/// the label in the active language.
struct TermMenu: View {
    @ObservedObject private var loc = Loc.shared
    let terms: [Term]
    @Binding var selection: String

    var body: some View {
        Menu {
            ForEach(terms) { term in
                Button(term.label(loc.effective)) { selection = term.key }
            }
        } label: {
            HStack {
                Text(currentLabel).foregroundStyle(Theme.textPrimary)
                Spacer()
                LucideChevronDown()
                    .stroke(Theme.textMuted, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                    .frame(width: 12, height: 7)
            }
            .modifier(FieldStyle())
        }
    }

    private var currentLabel: String {
        terms.first { $0.key == selection }?.label(loc.effective) ?? t("Choose")
    }
}

/// A 1...max dot scale. Tapping the current value clears it (nil), so optional
/// scales (impact, significance) can be left unset.
struct ScaleDots: View {
    @Binding var value: Int?
    var max: Int = 5

    var body: some View {
        HStack(spacing: 10) {
            ForEach(1...max, id: \.self) { i in
                Circle()
                    .fill((value ?? 0) >= i ? Theme.action : Theme.borderPrimary)
                    .frame(width: 18, height: 18)
                    .onTapGesture { value = (value == i) ? nil : i }
            }
        }
    }
}

/// Removable tag chips plus a field to add more.
struct TagField: View {
    @Binding var tags: [String]
    @State private var draft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            HStack(spacing: 6) {
                                Text(tag).font(Theme.body(12)).foregroundStyle(Theme.textPrimary)
                                Button { tags.removeAll { $0 == tag } } label: {
                                    LucideX()
                                        .stroke(Theme.textMuted, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                                        .frame(width: 8, height: 8)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Theme.action.opacity(0.12), in: Capsule())
                        }
                    }
                }
            }
            HStack(spacing: 8) {
                TextField(t("Add a tag"), text: $draft)
                    .modifier(FieldStyle())
                    .submitLabel(.done)
                    .onSubmit(add)
                Button(t("Add"), action: add)
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.textMuted : Theme.action)
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func add() {
        let value = draft.trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty, !tags.contains(value) else { return }
        tags.append(value)
        draft = ""
    }
}

/// A numeric year field binding an optional Int.
struct YearField: View {
    let placeholder: String
    @Binding var year: Int?

    var body: some View {
        TextField(placeholder, text: Binding(
            get: { year.map(String.init) ?? "" },
            set: { year = Int($0.filter(\.isNumber)) }
        ))
        .keyboardType(.numberPad)
        .modifier(FieldStyle())
    }
}

/// Recurring classification periods: start and end year rows, add and remove.
struct PeriodEditor: View {
    @Binding var periods: [ClassificationPeriodContent]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach($periods) { $period in
                HStack(spacing: 8) {
                    YearField(placeholder: t("Start"), year: Binding(
                        get: { period.start_year },
                        set: { period.start_year = $0 ?? period.start_year }
                    ))
                    Text(t("to")).font(Theme.body(13)).foregroundStyle(Theme.textMuted)
                    YearField(placeholder: t("Ongoing"), year: $period.end_year)
                    Button { periods.removeAll { $0.id == period.id } } label: {
                        LucideX()
                            .stroke(Theme.danger, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                            .frame(width: 12, height: 12)
                    }
                }
            }
            Button(t("Add period")) {
                periods.append(ClassificationPeriodContent(start_year: 2000))
            }
            .font(Theme.body(13, weight: .semibold))
            .foregroundStyle(Theme.action)
        }
    }
}

/// Multi-select of the tree's persons, storing their ids. Defaults come from
/// the form (the current person is pre-selected).
struct PersonMultiPicker: View {
    let persons: [TreePerson]
    @Binding var selected: Set<String>

    var body: some View {
        VStack(spacing: 0) {
            ForEach(persons) { person in
                Button { toggle(person.id) } label: {
                    HStack {
                        Text(person.name).foregroundStyle(Theme.textPrimary)
                        Spacer()
                        if selected.contains(person.id) {
                            LucideCheck()
                                .stroke(Theme.action, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                                .frame(width: 14, height: 11)
                        }
                    }
                    .padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if person.id != persons.last?.id {
                    Rectangle().fill(Theme.borderPrimary).frame(height: 0.5)
                }
            }
        }
    }

    private func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }
}

/// A down chevron in Lucide's grammar for dropdown affordances.
struct LucideChevronDown: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return p
    }
}

/// A small X in Lucide's grammar for remove affordances.
struct LucideX: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.move(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        return p
    }
}

/// A checkmark in Lucide's grammar for selected rows.
struct LucideCheck: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.minX + rect.width * 0.38, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return p
    }
}
