import SwiftUI

/// A person's page, read like a margin page in a family notebook, as on the
/// web: the name in the voice face, who they are to others in one glance
/// sentence (each name opens that person), then their lifeline: every trauma
/// event, life event, classification and turning point on one line in year
/// order, long silences named, undated entries below. The reflective layer is
/// editable here; names, relationships and the canvas stay desk work.
struct PersonSheet: View {
    @EnvironmentObject private var model: AppModel
    let person: TreePerson

    @State private var shownId: String?
    @State private var editing: StoryEditTarget?
    @State private var writing = false
    @State private var questionIndex = Int.random(in: 0..<8)

    private var tree: TreeData? { model.treeData }
    private var current: TreePerson {
        guard let id = shownId, let match = tree?.persons.first(where: { $0.id == id }) else { return person }
        return match
    }
    private var persons: [TreePerson] { tree?.persons ?? [] }
    private var story: PersonStory { tree?.stories[current.id] ?? PersonStory() }

    var body: some View {
        let entries = Lifeline.entries(story, birthYear: current.birthYear)
        let (rows, undated) = Lifeline.rows(entries, birthYear: current.birthYear, deathYear: current.deathYear)
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    glance.padding(.top, 14)

                    lifeHeading(count: entries.count).padding(.top, 26)
                    if rows.isEmpty && undated.isEmpty {
                        Text(t("Nothing recorded yet"))
                            .font(Theme.body(Theme.bodySize))
                            .foregroundStyle(Theme.textMuted)
                            .padding(.top, 10)
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(rows) { row in lifelineRow(row) }
                    }
                    .padding(.top, 12)

                    if !undated.isEmpty { undatedSection(undated).padding(.top, 22) }

                    addMenu.padding(.top, 20)
                    reflection.padding(.top, 30)
                    details.padding(.top, 26)

                    Text(t("Names, relationships, and the canvas are edited at the desk."))
                        .font(Theme.body(12))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.top, 20)
                        .padding(.bottom, 24)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.bgPrimary)
        .sheet(item: $editing) { target in
            switch target.kind {
            case .trauma:
                TraumaEventForm(editingId: target.editingId, persons: persons, defaultPersonId: current.id)
            case .life:
                LifeEventForm(editingId: target.editingId, persons: persons, defaultPersonId: current.id)
            case .turning:
                TurningPointForm(editingId: target.editingId, persons: persons, defaultPersonId: current.id)
            case .classification:
                ClassificationForm(editingId: target.editingId, persons: persons, defaultPersonId: current.id)
            }
        }
        .sheet(isPresented: $writing) {
            ComposerView(
                presetLinks: [.init(entityType: "person", entityId: current.id)],
                question: JournalPrompts.person(questionIndex, name: firstName(current.name))
            )
            .environmentObject(model)
        }
    }

    // MARK: Header and glance

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(current.name)
                .font(Theme.heading(21))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 28)
                .accessibilityAddTraits(.isHeader)
            if !yearsLine.isEmpty {
                Text(yearsLine)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)
            }
        }
    }

    private var yearsLine: String {
        var parts: [String] = []
        if let born = current.birthYear { parts.append(tf("Born {year}", ["year": String(born)])) }
        if let died = current.deathYear { parts.append(tf("Died {year}", ["year": String(died)])) }
        return parts.joined(separator: " · ")
    }

    /// "Married to Hendrik. Mother of Pieter and Anna." Each name opens that person.
    private var glance: some View {
        let groups = Glance.groups(for: current.id, edges: tree?.edges ?? [])
        return Group {
            if groups.isEmpty {
                Text(t("Not connected to anyone yet."))
                    .foregroundStyle(Theme.textMuted)
            } else {
                Text(glanceText(groups))
                    .foregroundStyle(Theme.textPrimary)
                    .tint(Theme.action)
            }
        }
        .font(Theme.body(Theme.bodySize))
        .lineSpacing(3)
        .environment(\.openURL, OpenURLAction { url in
            guard url.scheme == "person", let id = url.host() else { return .discarded }
            withAnimation(.easeOut(duration: 0.2)) { shownId = id }
            return .handled
        })
    }

    private func glanceText(_ groups: [GlanceGroup]) -> AttributedString {
        let byId = Dictionary(uniqueKeysWithValues: persons.map { ($0.id, $0) })
        var text = AttributedString()
        for (i, group) in groups.enumerated() {
            if i > 0 { text += AttributedString(" ") }
            text += AttributedString(roleLabel(group.role) + " ")
            let names = group.personIds.compactMap { byId[$0] }
            for (j, other) in names.enumerated() {
                var name = AttributedString(other.name)
                name.link = URL(string: "person://\(other.id)")
                name.underlineStyle = .single
                text += name
                if j < names.count - 2 { text += AttributedString(", ") }
                if j == names.count - 2 { text += AttributedString(" \(t("and")) ") }
            }
            text += AttributedString(".")
        }
        return text
    }

    private func roleLabel(_ role: GlanceRole) -> String {
        let gender = current.gender
        func pick(_ neutral: String, female: String? = nil, male: String? = nil) -> String {
            if gender == "female", let female { return t(female) }
            if gender == "male", let male { return t(male) }
            return t(neutral)
        }
        switch role {
        case .marriedTo: return t("Married to")
        case .partnerOf: return t("Partner of")
        case .formerPartnerOf: return t("Former partner of")
        case .childOf: return pick("Child of", female: "Daughter of", male: "Son of")
        case .stepChildOf: return pick("Stepchild of", female: "Stepdaughter of", male: "Stepson of")
        case .parentOf: return pick("Parent of", female: "Mother of", male: "Father of")
        case .stepParentOf: return pick("Step-parent of", female: "Stepmother of", male: "Stepfather of")
        case .siblingOf: return pick("Sibling of", female: "Sister of", male: "Brother of")
        case .halfSiblingOf: return pick("Half-sibling of", female: "Half-sister of", male: "Half-brother of")
        case .stepSiblingOf: return pick("Step-sibling of", female: "Stepsister of", male: "Stepbrother of")
        case .friendOf: return t("Friend of")
        }
    }

    // MARK: The lifeline

    private func lifeHeading(count: Int) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(t("Life"))
                .font(Theme.heading(18))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if count > 0 {
                Text(Plural.entries(count))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
            }
        }
    }

    private static let yearColumn: CGFloat = 50
    private static let spineColumn: CGFloat = 22

    /// One row of the line: the year (and age) on the left, the spine with its
    /// mark, then the row's content.
    @ViewBuilder
    private func lifelineRow(_ row: LifelineRow) -> some View {
        switch row {
        case .birth(let year):
            lineRow(year: year, age: nil, mark: AnyView(Capsule().fill(Theme.textMuted).frame(width: 10, height: 2))) {
                Text(t("Born")).font(Theme.body(Theme.bodySize)).foregroundStyle(Theme.textMuted)
            }
        case .death(let year):
            lineRow(year: year, age: age(at: year), mark: AnyView(Capsule().fill(Theme.textMuted).frame(width: 10, height: 2))) {
                Text(t("Died")).font(Theme.body(Theme.bodySize)).foregroundStyle(Theme.textMuted)
            }
        case .gap(let years, _):
            silence(years: years)
        case .entry(let entry):
            Button { editing = .edit(entry.kind.editKind, entry.item.id) } label: {
                lineRow(year: entry.year, age: entry.year.flatMap(age(at:)), mark: AnyView(StoryMark(kind: entry.kind, item: entry.item))) {
                    entryText(entry)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint(t("Opens this entry"))
        }
    }

    private func lineRow<Content: View>(year: Int?, age: Int?, mark: AnyView, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .trailing, spacing: 1) {
                if let year {
                    Text(String(year))
                        .font(Theme.body(14, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .monospacedDigit()
                }
                if let age {
                    Text(tf("age {age}", ["age": String(age)]))
                        .font(Theme.body(11))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .frame(width: Self.yearColumn, alignment: .trailing)

            mark
                .frame(width: Self.spineColumn, height: 18)
                .background(Theme.bgPrimary.opacity(0.001))

            content()
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)
        }
        .background(alignment: .topLeading) {
            Rectangle()
                .fill(Theme.borderPrimary)
                .frame(width: 2)
                .padding(.leading, Self.yearColumn + Self.spineColumn / 2 - 1)
        }
        .contentShape(Rectangle())
    }

    private func entryText(_ entry: LifelineEntry) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(entry.item.title.isEmpty ? t("Untitled") : entry.item.title)
                    .font(Theme.body(Theme.bodySize))
                    .foregroundStyle(Theme.textPrimary)
                    .multilineTextAlignment(.leading)
                if entry.item.pending {
                    Text(t("on this device"))
                        .font(Theme.body(11))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            Text(meta(entry))
                .font(Theme.body(12))
                .foregroundStyle(Theme.textMuted)
        }
    }

    /// "Loss, trauma event · with Harold and Dorothy" (the kind, its category, who else).
    private func meta(_ entry: LifelineEntry) -> String {
        let language = Loc.shared.effective
        var parts: [String] = []
        switch entry.kind {
        case .trauma:
            parts.append(Taxonomies.label(in: Taxonomies.trauma, key: entry.item.category ?? "", language: language))
        case .life:
            parts.append(Taxonomies.label(in: Taxonomies.life, key: entry.item.category ?? "", language: language))
        case .turning:
            parts.append(Taxonomies.label(in: Taxonomies.turning, key: entry.item.category ?? "", language: language))
        case .classification:
            parts.append(entry.item.category == "diagnosed" ? t("Diagnosed") : t("Suspected"))
            if let start = entry.year {
                parts.append(entry.endYear.map { "\(start) - \($0)" } ?? tf("{year} onwards", ["year": String(start)]))
            }
        }
        if entry.kind != .classification, let date = entry.item.date, !date.isEmpty, entry.year != nil,
           Int(date) == nil {
            parts.append(date)
        }
        let others = entry.item.personIds.filter { $0 != current.id }.compactMap { id in persons.first { $0.id == id } }
        if !others.isEmpty {
            parts.append(tf("with {names}", ["names": listJoin(others.map { firstName($0.name) })]))
        }
        return parts.joined(separator: " · ")
    }

    /// A long stretch without an entry, named, with a way to add something.
    private func silence(years: Int) -> some View {
        HStack(alignment: .top, spacing: 0) {
            Color.clear.frame(width: Self.yearColumn, height: 1)
            Rectangle()
                .fill(.clear)
                .frame(width: Self.spineColumn)
            VStack(alignment: .leading, spacing: 4) {
                Text(years == 1 ? tf("Nothing recorded for {count} year.", ["count": "1"])
                     : tf("Nothing recorded for {count} years.", ["count": String(years)]))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
                Menu {
                    addButtons
                } label: {
                    Text(t("Add something"))
                        .font(Theme.body(13, weight: .semibold))
                        .foregroundStyle(Theme.action)
                        .frame(minHeight: 44, alignment: .leading)
                }
            }
            .padding(.vertical, 6)
        }
        .background(alignment: .topLeading) {
            Rectangle()
                .stroke(style: StrokeStyle(lineWidth: 2, dash: [3, 5]))
                .foregroundStyle(Theme.borderPrimary)
                .frame(width: 2)
                .padding(.leading, Self.yearColumn + Self.spineColumn / 2 - 1)
        }
    }

    private func undatedSection(_ undated: [LifelineEntry]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(t("Without a year"))
                .font(Theme.heading(16))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .accessibilityAddTraits(.isHeader)
            ForEach(undated) { entry in
                Button { editing = .edit(entry.kind.editKind, entry.item.id) } label: {
                    HStack(alignment: .top, spacing: 10) {
                        StoryMark(kind: entry.kind, item: entry.item).frame(width: 18, height: 18)
                        entryText(entry)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Adding, reflecting, details

    @ViewBuilder private var addButtons: some View {
        Button(t("Trauma event")) { editing = .create(.trauma) }
        Button(t("Life event")) { editing = .create(.life) }
        Button(t("Classification")) { editing = .create(.classification) }
        Button(t("Turning point")) { editing = .create(.turning) }
    }

    private var addMenu: some View {
        Menu {
            addButtons
        } label: {
            ActionLabel(mark: LucidePlus(), text: tf("Add to {name}'s life", ["name": firstName(current.name)]),
                        color: Theme.action, markSize: 11)
                .frame(minHeight: 44)
        }
    }

    /// One open question about this person, in the voice face, that leads to the journal.
    private var reflection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(JournalPrompts.person(questionIndex, name: firstName(current.name)))
                .font(Theme.heading(16))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
            Button { writing = true } label: {
                ActionLabel(mark: LucidePlus(), text: t("Write in your journal"), color: Theme.action, markSize: 11)
                    .frame(minHeight: 44)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 18)
        .overlay(alignment: .top) { Rectangle().fill(Theme.borderPrimary).frame(height: 1) }
    }

    private var details: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 8) {
                if current.isAdopted {
                    Text(t("Adopted"))
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.textPrimary)
                }
                if let notes = current.notes, !notes.isEmpty {
                    Text(notes)
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.textPrimary)
                } else if !current.isAdopted {
                    Text(t("None yet."))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)
        } label: {
            Text(t("Details"))
                .font(Theme.body(Theme.bodySize, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
        }
        .tint(Theme.textMuted)
    }

    private func age(at year: Int) -> Int? {
        guard let born = current.birthYear, year >= born else { return nil }
        return year - born
    }

    private func firstName(_ name: String) -> String {
        name.split(separator: " ").first.map(String.init) ?? name
    }
}

/// An entry's mark in the badge grammar: circle, square, triangle (hollow when
/// suspected), star, in the category colour.
struct StoryMark: View {
    let kind: StoryKind
    let item: StoryItem

    var body: some View {
        Group {
            switch kind {
            case .trauma:
                Circle().fill(CategoryColors.trauma(item.category)).frame(width: 11, height: 11)
            case .life:
                RoundedRectangle(cornerRadius: 2).fill(CategoryColors.life(item.category)).frame(width: 11, height: 11)
            case .classification:
                if item.category == "diagnosed" {
                    StoryTriangle().fill(CategoryColors.classification(item.category)).frame(width: 12, height: 11)
                } else {
                    StoryTriangle().stroke(CategoryColors.classification(item.category), lineWidth: 1.6)
                        .frame(width: 12, height: 11)
                }
            case .turning:
                StarShape().fill(CategoryColors.turning(item.category)).frame(width: 13, height: 13)
            }
        }
        .padding(3)
        .background(Theme.bgPrimary, in: Circle())
        .accessibilityHidden(true)
    }
}

/// A five-point star in the badge grammar (turning points).
struct StarShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let c = CGPoint(x: rect.midX, y: rect.midY + rect.height * 0.04)
        let r = min(rect.width, rect.height) / 2
        for i in 0..<10 {
            let radius = i % 2 == 0 ? r : r * 0.45
            let a = -CGFloat.pi / 2 + CGFloat(i) * .pi / 5
            let p = CGPoint(x: c.x + radius * cos(a), y: c.y + radius * sin(a))
            i == 0 ? path.move(to: p) : path.addLine(to: p)
        }
        path.closeSubpath()
        return path
    }
}
