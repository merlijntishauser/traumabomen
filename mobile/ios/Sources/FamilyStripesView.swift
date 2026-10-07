import SwiftUI
import TraumabomenCore

/// The timeline as family stripes, adapted to the phone: each life is one band
/// of whole-year cells, names pinned on the left while the field scrolls
/// sideways, one year (or age) read at a time below it. Switching Years and
/// Age slides every life into place (the one authored motion; off under
/// Reduce Motion). Tapping an entry or a key item lights up its matches.
struct FamilyStripesView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let data: TreeData

    @State private var mode: StripeMode = .years
    @State private var chosenYear: Int?
    @State private var chosenAge: Int?
    @State private var litEntryId: String?
    @State private var pinnedKey: String?
    @State private var openPerson: TreePerson?
    @State private var editing: StoryEditTarget?
    @State private var editingPersonId: String?

    private let now = Calendar.current.component(.year, from: Date())

    // Geometry, in points.
    private static let cell: CGFloat = 7
    private static let rulerHeight: CGFloat = 36
    private static let genHeight: CGFloat = 26
    private static let rowHeight: CGFloat = 48
    private static let band: CGFloat = 22
    private static let namesWidth: CGFloat = 104

    var body: some View {
        let model = StripesModel(data: data, now: now)
        if model.layout.rows.isEmpty {
            empty
        } else {
            content(model)
        }
    }

    // MARK: Derived state

    private struct StripesModel {
        let layout: StripeLayout
        let entries: [StripeEntry]
        let mine: [String: [StripeEntry]]
        let start: Int
        let ageSpan: Int
        let undatedTotal: Int
        let undatedByPerson: [String: Int]

        init(data: TreeData, now: Int) {
            let people = FamilyStripes.familyPersons(data.persons, edges: data.edges)
            layout = FamilyStripes.layout(
                persons: people,
                generations: FamilyStripes.generations(persons: people, edges: data.edges),
                now: now
            )
            entries = FamilyStripes.entries(from: data.stories, now: now)
            mine = FamilyStripes.byPerson(layout.rows, entries)
            start = FamilyStripes.yearStart(layout.rows, now: now)
            ageSpan = FamilyStripes.ageSpan(layout.rows)
            undatedByPerson = FamilyStripes.undatedCounts(data.stories)
            var undatedIds: Set<String> = []
            for story in data.stories.values {
                for item in story.trauma + story.life + story.turning
                where DateReader.shared.read(text: item.date) == nil { undatedIds.insert(item.id) }
                for item in story.classifications where item.periods.isEmpty && Int(item.date ?? "") == nil {
                    undatedIds.insert(item.id)
                }
            }
            undatedTotal = undatedIds.count
        }
    }

    private func bounds(_ m: StripesModel) -> (min: Int, max: Int, span: Int) {
        mode == .years ? (m.start, now, now - m.start + 1) : (0, m.ageSpan - 1, m.ageSpan)
    }

    private func value(_ m: StripesModel) -> Int {
        if mode == .years {
            return chosenYear ?? FamilyStripes.busiest(m.layout.rows, m.entries, mode: .years, min: m.start, max: now, now: now)
        }
        return chosenAge ?? FamilyStripes.busiest(m.layout.rows, m.entries, mode: .age, min: 0, max: m.ageSpan - 1, now: now)
    }

    private func setValue(_ next: Int, _ m: StripesModel) {
        let b = bounds(m)
        let clamped = min(b.max, max(b.min, next))
        if mode == .years { chosenYear = clamped } else { chosenAge = clamped }
    }

    private func lit(_ m: StripesModel) -> Set<String>? {
        if let id = litEntryId { return FamilyStripes.match(entry: id, in: m.entries) }
        if let key = pinnedKey { return FamilyStripes.match(key: key, in: m.entries) }
        return nil
    }

    // MARK: Layout

    private func content(_ m: StripesModel) -> some View {
        let current = value(m)
        let lit = lit(m)
        return ScrollViewReader { outer in ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Picker(t("Line lives up by"), selection: Binding(
                    get: { mode },
                    set: { next in
                        if reduceMotion { mode = next } else {
                            withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: 0.56)) { mode = next }
                        }
                    }
                )) {
                    Text(t("Years")).tag(StripeMode.years)
                    Text(t("Age")).tag(StripeMode.age)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 24)
                .padding(.top, 8)

                field(m, current: current, lit: lit)
                    .padding(.top, 12)

                StripesKeyView(entries: m.entries, lit: lit, pinnedKey: $pinnedKey, onPin: { litEntryId = nil })
                    .padding(.horizontal, 24)
                    .padding(.top, 14)

                if m.undatedTotal > 0 {
                    Text(m.undatedTotal == 1
                         ? t("1 entry has no year yet, so it is not on the stripes.")
                         : tf("{count} entries have no year yet, so they are not on the stripes.", ["count": String(m.undatedTotal)]))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 24)
                        .padding(.top, 10)
                }
                if !m.layout.unplaced.isEmpty {
                    Text(tf("Not on the timeline yet, no birth year: {names}.",
                            ["names": listJoin(m.layout.unplaced.map(\.name))]))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 24)
                        .padding(.top, 8)
                }

                reading(m, current: current, lit: lit)
                    .padding(.top, 22)
                    .padding(.bottom, 32)
                    .id("reading")
            }
        }
        #if DEBUG
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("-scrollToReading") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { outer.scrollTo("reading", anchor: .top) }
            }
        }
        #endif
        }
        .sheet(item: $openPerson) { PersonSheet(person: $0) }
        .sheet(item: $editing) { target in
            let persons = data.persons
            let pid = editingPersonId ?? ""
            switch target.kind {
            case .trauma: TraumaEventForm(editingId: target.editingId, persons: persons, defaultPersonId: pid)
            case .life: LifeEventForm(editingId: target.editingId, persons: persons, defaultPersonId: pid)
            case .turning: TurningPointForm(editingId: target.editingId, persons: persons, defaultPersonId: pid)
            case .classification: ClassificationForm(editingId: target.editingId, persons: persons, defaultPersonId: pid)
            }
        }
    }

    /// Names pinned on the left; the stripes scroll sideways and keep the read column in view.
    private func field(_ m: StripesModel, current: Int, lit: Set<String>?) -> some View {
        let b = bounds(m)
        let width = CGFloat(b.span) * Self.cell
        let readX = CGFloat(current - b.min) * Self.cell
        let height = fieldHeight(m.layout)
        return HStack(alignment: .top, spacing: 0) {
            namesColumn(m)
                .frame(width: Self.namesWidth, alignment: .leading)
                .padding(.leading, 24)
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    ZStack(alignment: .topLeading) {
                        HStack(spacing: 0) {
                            Color.clear.frame(width: max(0, readX - 60), height: 1)
                            Color.clear.frame(width: 120, height: 1).id("read")
                        }
                        RulerView(mode: mode, start: b.min, span: b.span, now: now, height: height,
                                  cell: Self.cell, readX: readX, rulerHeight: Self.rulerHeight)
                        ForEach(Array(rowPositions(m.layout).enumerated()), id: \.element.row.id) { _, item in
                            StripeRowView(row: item.row, entries: m.mine[item.row.person.id] ?? [],
                                          cell: Self.cell, band: Self.band, lit: lit)
                                .frame(width: CGFloat(item.row.last - item.row.born + 1) * Self.cell, height: Self.rowHeight)
                                .offset(x: mode == .years ? CGFloat(item.row.born - m.start) * Self.cell : 0, y: item.y)
                        }
                        ForEach(Array(generationTops(m.layout).enumerated()), id: \.offset) { _, y in
                            Rectangle().fill(Theme.borderPrimary)
                                .frame(width: width + 24, height: 1)
                                .offset(y: y)
                        }
                        ReadColumn(x: readX, cell: Self.cell, height: height, rulerHeight: Self.rulerHeight,
                                   label: mode == .years ? String(current) : tf("Age {age}", ["age": String(current)]))
                    }
                    .frame(width: width + 24, height: height, alignment: .topLeading)
                    .contentShape(Rectangle())
                    .onTapGesture { location in
                        let index = Int(location.x / Self.cell)
                        if index >= 0, index < b.span { setValue(b.min + index, m) }
                    }
                    .accessibilityElement()
                    .accessibilityLabel(mode == .years ? t("Year being read") : t("Age being read"))
                    .accessibilityValue(mode == .years ? String(current) : tf("Age {age}", ["age": String(current)]))
                    .accessibilityAdjustableAction { direction in
                        setValue(current + (direction == .increment ? 1 : -1), m)
                    }
                }
                .onAppear { proxy.scrollTo("read", anchor: .center) }
                .onChange(of: current) { _, _ in
                    withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("read", anchor: .center) }
                }
                .onChange(of: mode) { _, _ in proxy.scrollTo("read", anchor: .center) }
            }
        }
    }

    private func fieldHeight(_ layout: StripeLayout) -> CGFloat {
        Self.rulerHeight + CGFloat(layout.generations.count) * Self.genHeight
            + CGFloat(layout.rows.count) * Self.rowHeight + 8
    }

    /// Where each generation after the first begins: a hairline separates generations.
    private func generationTops(_ layout: StripeLayout) -> [CGFloat] {
        var y = Self.rulerHeight
        var out: [CGFloat] = []
        for (index, group) in layout.generations.enumerated() {
            if index > 0 { out.append(y + 4) }
            y += Self.genHeight + CGFloat(group.rows.count) * Self.rowHeight
        }
        return out
    }

    private func rowPositions(_ layout: StripeLayout) -> [(row: StripeRow, y: CGFloat)] {
        var y = Self.rulerHeight
        var out: [(StripeRow, CGFloat)] = []
        for group in layout.generations {
            y += Self.genHeight
            for row in group.rows {
                out.append((row, y))
                y += Self.rowHeight
            }
        }
        return out
    }

    private func namesColumn(_ m: StripesModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: Self.rulerHeight)
            ForEach(Array(m.layout.generations.enumerated()), id: \.offset) { index, group in
                Text(tf("Generation {number}", ["number": String(index + 1)]))
                    .font(Theme.body(11))
                    .foregroundStyle(Theme.textMuted)
                    .frame(maxWidth: .infinity, minHeight: Self.genHeight, maxHeight: Self.genHeight, alignment: .bottomLeading)
                    .overlay(alignment: .top) {
                        if index > 0 { Rectangle().fill(Theme.borderPrimary).frame(height: 1).padding(.top, 4) }
                    }
                ForEach(group.rows) { row in
                    Button { openPerson = row.person } label: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(firstName(row.person.name))
                                .font(Theme.heading(14))
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(1)
                            HStack(spacing: 4) {
                                Text(yearsText(row))
                                    .font(Theme.body(11))
                                    .foregroundStyle(Theme.textMuted)
                                    .monospacedDigit()
                                if let undated = m.undatedByPerson[row.person.id] {
                                    Text("· \(undated)?")
                                        .font(Theme.body(11, weight: .semibold))
                                        .foregroundStyle(Theme.action)
                                        .accessibilityLabel(undated == 1 ? t("1 without a year")
                                                            : tf("{count} without a year", ["count": String(undated)]))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: Self.rowHeight, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .opacity(dimmed(row, m) ? 0.32 : 1)
                }
            }
        }
    }

    private func dimmed(_ row: StripeRow, _ m: StripesModel) -> Bool {
        guard let lit = lit(m) else { return false }
        return !m.entries.contains { lit.contains($0.id) && $0.personIds.contains(row.person.id) }
    }

    private func yearsText(_ row: StripeRow) -> String {
        if let died = row.person.deathYear { return "\(row.born) - \(died)" }
        if row.endUnknown { return "\(row.born) - ?" }
        return tf("{born}, living", ["born": String(row.born)])
    }

    // MARK: Reading

    private func reading(_ m: StripesModel, current: Int, lit: Set<String>?) -> some View {
        let r = FamilyStripes.read(m.layout.rows, m.entries, mode: mode, value: current, now: now)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .lastTextBaseline) {
                HStack(alignment: .lastTextBaseline, spacing: 6) {
                    if mode == .age {
                        Text(t("Age")).font(Theme.body(15)).foregroundStyle(Theme.textMuted)
                    }
                    Text(String(current))
                        .font(Theme.body(40, weight: .light))
                        .foregroundStyle(Theme.textPrimary)
                        .monospacedDigit()
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Spacer()
                stepButton(left: true) { setValue(current - 1, m) }
                stepButton(left: false) { setValue(current + 1, m) }
            }
            Text(mode == .years ? t("Tap a year in the stripes.") : t("Lives start together at birth. Tap an age."))
                .font(Theme.body(13))
                .foregroundStyle(Theme.textMuted)
                .padding(.top, -8)

            VStack(alignment: .leading, spacing: 0) {
                ForEach(r.blocks) { block in
                    readingBlock(block, lit: lit)
                    Rectangle().fill(Theme.borderPrimary).frame(height: 1)
                }
            }

            let notes = absentNotes(r, m, current: current)
            if !notes.isEmpty {
                Text(notes)
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(question(current))
                .font(Theme.heading(16))
                .fontWeight(.light)
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
                .overlay(alignment: .top) { Rectangle().fill(Theme.borderPrimary).frame(height: 1).offset(y: -6) }
        }
        .padding(.horizontal, 24)
    }

    private func stepButton(left: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Group {
                if left {
                    LucideChevronLeft().stroke(Theme.textPrimary, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                } else {
                    LucideChevronRight().stroke(Theme.textPrimary, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                }
            }
            .frame(width: 7, height: 12)
            .frame(width: 44, height: 44)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.borderPrimary, lineWidth: 1).frame(width: 36, height: 36))
        }
        .accessibilityLabel(left
            ? (mode == .years ? t("Previous year") : t("Previous age"))
            : (mode == .years ? t("Next year") : t("Next age")))
    }

    private func readingBlock(_ block: ReadingBlock, lit: Set<String>?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                blockNames(block)
                Spacer()
                Text(blockMeta(block))
                    .font(Theme.body(12))
                    .foregroundStyle(Theme.textMuted)
                    .monospacedDigit()
            }
            ForEach(block.entries) { entry in
                HStack(alignment: .top, spacing: 10) {
                    Button {
                        pinnedKey = nil
                        litEntryId = litEntryId == entry.id ? nil : entry.id
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            StripeEntryMark(entry: entry).padding(.top, 4)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(entry.title.isEmpty ? t("Untitled") : entry.title)
                                    .font(Theme.body(Theme.bodySize))
                                    .foregroundStyle(Theme.textPrimary)
                                    .multilineTextAlignment(.leading)
                                Text(entryMeta(entry, year: block.years[0]))
                                    .font(Theme.body(12))
                                    .foregroundStyle(Theme.textMuted)
                            }
                            Spacer(minLength: 0)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint(t("Lights up every entry with the same title"))
                    .accessibilityAddTraits(litEntryId == entry.id ? .isSelected : [])

                    Button {
                        editingPersonId = block.people.first?.person.id
                        editing = .edit(entry.kind.editKind, entry.id)
                    } label: {
                        LucideChevronRight()
                            .stroke(Theme.textMuted, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                            .frame(width: 6, height: 11)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(t("Opens this entry"))
                }
                .opacity(lit.map { $0.contains(entry.id) } == false ? 0.32 : 1)
            }
        }
        .padding(.vertical, 10)
    }

    /// Each name opens that person; a shared surname is said once ("Sophie and Lucas Porter").
    private func blockNames(_ block: ReadingBlock) -> some View {
        let names = block.people.map(\.person.name)
        let surnames = names.map { $0.split(separator: " ").dropFirst().joined(separator: " ") }
        let shared = names.count > 1 && !surnames[0].isEmpty && surnames.allSatisfy { $0 == surnames[0] }
        let labels = shared ? names.map(firstName) : names
        var text = AttributedString()
        for (i, row) in block.people.enumerated() {
            var name = AttributedString(labels[i])
            name.link = URL(string: "person://\(row.person.id)")
            text += name
            if i < block.people.count - 2 { text += AttributedString(", ") }
            if i == block.people.count - 2 { text += AttributedString(" \(t("and")) ") }
        }
        if shared { text += AttributedString(" " + surnames[0]) }
        return Text(text)
            .font(Theme.heading(15))
            .foregroundStyle(Theme.textPrimary)
            .tint(Theme.textPrimary)
            .environment(\.openURL, OpenURLAction { url in
                guard url.scheme == "person", let id = url.host(),
                      let person = data.persons.first(where: { $0.id == id }) else { return .discarded }
                openPerson = person
                return .handled
            })
    }

    private func blockMeta(_ block: ReadingBlock) -> String {
        if mode == .age {
            let year = block.years[0]
            return year == now ? tf("in {year}, this year", ["year": String(year)]) : tf("in {year}", ["year": String(year)])
        }
        let ages = zip(block.people, block.years).map { $1 - $0.born }
        if ages.count > 1 { return tf("ages {ages}", ["ages": listJoin(ages.map(String.init))]) }
        return ages[0] == 0 ? t("born this year") : tf("age {age}", ["age": String(ages[0])])
    }

    private func entryMeta(_ entry: StripeEntry, year: Int) -> String {
        let language = Loc.shared.effective
        let category: String
        switch entry.kind {
        case .trauma: category = Taxonomies.label(in: Taxonomies.trauma, key: entry.category, language: language)
        case .life: category = Taxonomies.label(in: Taxonomies.life, key: entry.category, language: language)
        case .turning: category = Taxonomies.label(in: Taxonomies.turning, key: entry.category, language: language)
        case .classification: category = entry.category == "diagnosed" ? t("Diagnosed") : t("Suspected")
        }
        var date: String
        if let relative = entry.relative, relative.kind == .ages {
            let from = Int(relative.from), to = Int(relative.to)
            date = from == to ? tf("at {age}", ["age": String(from)])
                : to >= 100 ? tf("from age {age}", ["age": String(from)])
                : tf("ages {from} to {to}", ["from": String(from), "to": String(to)])
        } else if let span = entry.span(at: year) {
            date = span.from == span.to ? String(span.from)
                : (entry.kind == .classification && span.to == now)
                    ? tf("{year} onwards", ["year": String(span.from)])
                    : tf("{from} to {to}", ["from": String(span.from), "to": String(span.to)])
            if entry.approx { date = tf("about {when}", ["when": date]) }
        } else {
            date = ""
        }
        return [category.lowercased(with: Locale(identifier: language)), date].filter { !$0.isEmpty }.joined(separator: ", ")
    }

    private func absentNotes(_ r: StripeReading, _ m: StripesModel, current: Int) -> String {
        func names(_ rows: [StripeRow]) -> String { listJoin(rows.map { firstName($0.person.name) }) }
        var notes: [String] = []
        let unsure = r.quiet.filter { m.undatedByPerson[$0.person.id] != nil }
        let quiet = r.quiet.filter { m.undatedByPerson[$0.person.id] == nil }
        if !quiet.isEmpty { notes.append(tf("Nothing recorded: {names}.", ["names": names(quiet)])) }
        if !unsure.isEmpty {
            notes.append(unsure.count == 1
                ? tf("{names} has entries without a year, so there may be more here than the stripes show.", ["names": names(unsure)])
                : tf("{names} have entries without a year, so there may be more here than the stripes show.", ["names": names(unsure)]))
        }
        if mode == .years {
            if !r.notYet.isEmpty { notes.append(tf("Not yet born: {names}.", ["names": names(r.notYet)])) }
            if !r.gone.isEmpty { notes.append(tf("Had died: {names}.", ["names": names(r.gone)])) }
        } else {
            if !r.notYet.isEmpty { notes.append(tf("Not yet {age}: {names}.", ["age": String(current), "names": names(r.notYet)])) }
            if !r.gone.isEmpty { notes.append(tf("Did not reach {age}: {names}.", ["age": String(current), "names": names(r.gone)])) }
        }
        return notes.joined(separator: " ")
    }

    private func question(_ current: Int) -> String {
        if mode == .years {
            let questions = [
                t("What did the youngest in the family understand about this year?"),
                t("Who carried this year, and who was kept outside it?"),
                t("What was said at the table that year, and what was not?"),
                t("Who could anyone turn to that year?"),
            ]
            return questions[current % questions.count]
        }
        let a = String(current)
        let questions = [
            tf("What was it like to be {age} in each of these homes?", ["age": a]),
            tf("What did each of them need at {age}, and who could give it?", ["age": a]),
            tf("What do you remember of being {age} yourself?", ["age": a]),
        ]
        return questions[current % questions.count]
    }

    private var empty: some View {
        VStack {
            Spacer()
            Text(t("Add a birth year to someone in the tree to see the family here."))
                .font(Theme.body(Theme.bodySize))
                .foregroundStyle(Theme.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
    }

    private func firstName(_ name: String) -> String {
        name.split(separator: " ").first.map(String.init) ?? name
    }
}

// MARK: - Drawing

/// One life: the lived band, trauma filling its years (stacked when several
/// share a year), classifications as a rule along the foot, life events as
/// squares on the band's edge, turning points as a star above.
private struct StripeRowView: View {
    let row: StripeRow
    let entries: [StripeEntry]
    let cell: CGFloat
    let band: CGFloat
    let lit: Set<String>?

    var body: some View {
        Canvas { ctx, _ in
            let top: CGFloat = 12
            let xOf = { (year: Int) in CGFloat(year - row.born) * cell }
            ctx.fill(Path(roundedRect: CGRect(x: 0, y: top, width: CGFloat(row.last - row.born + 1) * cell, height: band), cornerRadius: 3),
                     with: .color(StripeColors.lived))
            func alpha(_ e: StripeEntry) -> Double { lit.map { $0.contains(e.id) ? 1 : 0.14 } ?? 1 }

            for run in FamilyStripes.traumaRuns(entries, born: row.born, last: row.last) {
                let slice = band / CGFloat(run.entries.count)
                let rect = { (k: Int) in CGRect(x: xOf(run.start), y: top + CGFloat(k) * slice,
                                               width: CGFloat(run.end - run.start + 1) * cell, height: slice) }
                for (k, e) in run.entries.enumerated() {
                    var layer = ctx
                    layer.opacity = alpha(e)
                    if e.approx {
                        hatch(rect(k), color: CategoryColors.trauma(e.category), in: &layer, base: StripeColors.lived)
                    } else {
                        layer.fill(Path(rect(k)), with: .color(CategoryColors.trauma(e.category)))
                    }
                    if k > 0 {
                        ctx.fill(Path(CGRect(x: rect(k).minX, y: rect(k).minY - 1.5, width: rect(k).width, height: 3)),
                                 with: .color(Theme.bgPrimary))
                    }
                }
            }
            for e in entries where e.kind == .classification {
                for span in e.spans {
                    guard let clipped = FamilyStripes.clip(span, born: row.born, last: row.last) else { continue }
                    let rect = CGRect(x: xOf(clipped.from), y: top + band + 5, width: CGFloat(clipped.to - clipped.from + 1) * cell, height: 3)
                    var layer = ctx
                    layer.opacity = alpha(e)
                    let color = CategoryColors.classification(e.category)
                    if e.category == "suspected" { hatch(rect, color: color, in: &layer, base: nil) }
                    else { layer.fill(Path(roundedRect: rect, cornerRadius: 1), with: .color(color)) }
                }
            }
            for e in entries where e.kind == .life {
                guard let span = e.spans.first, FamilyStripes.clip(span, born: row.born, last: row.last) != nil else { continue }
                var layer = ctx
                layer.opacity = alpha(e)
                let rect = CGRect(x: xOf(span.from) + cell / 2 - 4, y: top + band - 4, width: 8, height: 8)
                layer.fill(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(CategoryColors.life(e.category)))
                layer.stroke(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(Theme.bgPrimary), lineWidth: 1.5)
            }
            for e in entries where e.kind == .turning {
                guard let span = e.spans.first, FamilyStripes.clip(span, born: row.born, last: row.last) != nil else { continue }
                var layer = ctx
                layer.opacity = alpha(e)
                let rect = CGRect(x: xOf(span.from) + cell / 2 - 5, y: top - 11, width: 10, height: 10)
                layer.fill(StarShape().path(in: rect), with: .color(CategoryColors.turning(e.category)))
            }
        }
        .accessibilityHidden(true)
    }

    /// Diagonal hatching: approximate dates and suspected classifications are form, not a second hue.
    private func hatch(_ rect: CGRect, color: Color, in ctx: inout GraphicsContext, base: Color?) {
        if let base { ctx.fill(Path(rect), with: .color(base)) }
        ctx.drawLayer { layer in
            layer.clip(to: Path(rect))
            var x = rect.minX - rect.height
            while x < rect.maxX {
                var p = Path()
                p.move(to: CGPoint(x: x, y: rect.maxY))
                p.addLine(to: CGPoint(x: x + rect.height, y: rect.minY))
                layer.stroke(p, with: .color(color), lineWidth: 1.6)
                x += 4
            }
        }
    }
}

/// The decade ruler, its grid, generation-free, and a dashed line at today.
private struct RulerView: View {
    let mode: StripeMode
    let start: Int
    let span: Int
    let now: Int
    let height: CGFloat
    let cell: CGFloat
    let readX: CGFloat
    let rulerHeight: CGFloat

    var body: some View {
        Canvas { ctx, _ in
            for i in stride(from: 0, through: span - 3, by: 10) {
                let x = CGFloat(i) * cell
                var line = Path()
                line.move(to: CGPoint(x: x, y: rulerHeight - 6))
                line.addLine(to: CGPoint(x: x, y: height))
                ctx.stroke(line, with: .color(StripeColors.grid), lineWidth: 1)
                // Labels the year flag would cover step aside to its nearer edge, as on the web.
                let label = Text(String(mode == .years ? start + i : i))
                    .font(Theme.body(11))
                    .foregroundStyle(Theme.textMuted)
                let labelWidth: CGFloat = 30
                let flagLeft = readX + cell / 2 - 24, flagRight = readX + cell / 2 + 24
                let start = x + 3, end = x + 3 + labelWidth
                let y = rulerHeight - 14
                if end <= flagLeft || start >= flagRight {
                    ctx.draw(label, at: CGPoint(x: start, y: y), anchor: .leading)
                } else if start + labelWidth / 2 < readX + cell / 2 {
                    if flagLeft - labelWidth > x - 10 * cell + 3 + labelWidth + 4 {
                        ctx.draw(label, at: CGPoint(x: flagLeft - 2, y: y), anchor: .trailing)
                    }
                } else if flagRight + 2 + labelWidth < x + 10 * cell - 1 {
                    ctx.draw(label, at: CGPoint(x: flagRight + 2, y: y), anchor: .leading)
                }
            }
            if mode == .years {
                let x = CGFloat(now - start + 1) * cell
                var today = Path()
                today.move(to: CGPoint(x: x, y: rulerHeight - 6))
                today.addLine(to: CGPoint(x: x, y: height))
                ctx.stroke(today, with: .color(Theme.textMuted), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The one reserved ink: the column being read and its flag on the ruler.
private struct ReadColumn: View {
    let x: CGFloat
    let cell: CGFloat
    let height: CGFloat
    let rulerHeight: CGFloat
    let label: String

    var body: some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(StripeColors.readWash)
                .overlay(Rectangle().stroke(StripeColors.read, lineWidth: 1.5))
                .frame(width: cell, height: height - rulerHeight + 6)
                .offset(x: x, y: rulerHeight - 6)
            Text(label)
                .font(Theme.body(11, weight: .bold))
                .foregroundStyle(StripeColors.readInk)
                .monospacedDigit()
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(StripeColors.read, in: RoundedRectangle(cornerRadius: 4))
                .fixedSize()
                .offset(x: max(0, x + cell / 2 - 22), y: 2)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// The stripe tokens from theme.css: the lived years, the decade grid, and the reading ink.
enum StripeColors {
    static let lived = Theme.adaptive(dark: 0x1b3428, light: 0xe3ddd3)
    static let grid = Color.primary.opacity(0.07)
    static let read = Theme.adaptive(dark: 0xffffff, light: 0x14110f)
    static let readWash = Color.primary.opacity(0.08)
    static let readInk = Theme.adaptive(dark: 0x0a1a0f, light: 0xffffff)
}

/// An entry's badge in the reading list.
private struct StripeEntryMark: View {
    let entry: StripeEntry

    var body: some View {
        Group {
            switch entry.kind {
            case .trauma: Circle().fill(CategoryColors.trauma(entry.category)).frame(width: 10, height: 10)
            case .life: RoundedRectangle(cornerRadius: 2).fill(CategoryColors.life(entry.category)).frame(width: 10, height: 10)
            case .classification:
                if entry.category == "diagnosed" {
                    StoryTriangle().fill(CategoryColors.classification(entry.category)).frame(width: 11, height: 10)
                } else {
                    StoryTriangle().stroke(CategoryColors.classification(entry.category), lineWidth: 1.5).frame(width: 11, height: 10)
                }
            case .turning: StarShape().fill(CategoryColors.turning(entry.category)).frame(width: 12, height: 12)
            }
        }
        .frame(width: 14, height: 14)
        .accessibilityHidden(true)
    }
}

/// The key: each category present, by group; tap an item to keep everything it describes lit.
private struct StripesKeyView: View {
    let entries: [StripeEntry]
    let lit: Set<String>?
    @Binding var pinnedKey: String?
    let onPin: () -> Void

    var body: some View {
        let used = Set(entries.map(\.keyId))
        let language = Loc.shared.effective
        VStack(alignment: .leading, spacing: 10) {
            group(t("Trauma fills the year"), items:
                Taxonomies.trauma.filter { used.contains("trauma_event:\($0.key)") }.map {
                    KeyItem(key: "trauma_event:\($0.key)", label: $0.label(language),
                            swatch: AnyView(RoundedRectangle(cornerRadius: 2).fill(CategoryColors.trauma($0.key)).frame(width: 14, height: 10)))
                } + (entries.contains { $0.approx } ? [KeyItem(key: "approx", label: t("Approximate date"),
                    swatch: AnyView(HatchSwatch().frame(width: 14, height: 10)))] : []))
            group(t("Life events"), items:
                Taxonomies.life.filter { used.contains("life_event:\($0.key)") }.map {
                    KeyItem(key: "life_event:\($0.key)", label: $0.label(language),
                            swatch: AnyView(RoundedRectangle(cornerRadius: 1.5).fill(CategoryColors.life($0.key)).frame(width: 9, height: 9)))
                })
            group(t("Marks"), items:
                (used.contains("classification:diagnosed") ? [KeyItem(key: "classification:diagnosed", label: t("Diagnosed"),
                    swatch: AnyView(Capsule().fill(CategoryColors.classification("diagnosed")).frame(width: 16, height: 3)))] : [])
                + (used.contains("classification:suspected") ? [KeyItem(key: "classification:suspected", label: t("Suspected"),
                    swatch: AnyView(HatchSwatch(color: CategoryColors.classification("suspected"), base: nil).frame(width: 16, height: 4)))] : []))
            group(t("Turning points"), items:
                Taxonomies.turning.filter { used.contains("turning_point:\($0.key)") }.map {
                    KeyItem(key: "turning_point:\($0.key)", label: $0.label(language),
                            swatch: AnyView(StarShape().fill(CategoryColors.turning($0.key)).frame(width: 11, height: 11)))
                })
        }
    }

    private struct KeyItem {
        let key: String
        let label: String
        let swatch: AnyView
    }

    @ViewBuilder
    private func group(_ label: String, items: [KeyItem]) -> some View {
        if !items.isEmpty {
            FlowLayout(spacing: 6, lineSpacing: 2) {
                Text(label)
                    .font(Theme.body(12))
                    .foregroundStyle(Theme.textMuted)
                    .frame(minHeight: 32)
                ForEach(items, id: \.key) { item in
                    let pinned = pinnedKey == item.key
                    Button {
                        onPin()
                        pinnedKey = pinned ? nil : item.key
                    } label: {
                        HStack(spacing: 5) {
                            item.swatch
                            Text(item.label)
                                .font(Theme.body(12))
                                .foregroundStyle(pinned ? Theme.textPrimary : Theme.textSecondary)
                                .underline(pinned)
                        }
                        .padding(.horizontal, 4)
                        .frame(minHeight: 32)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(pinned ? .isSelected : [])
                    .accessibilityHint(t("Lights up everything it describes"))
                }
            }
        }
    }
}

/// The key's hatched swatch, drawn the way the field hatches: approximate
/// dates over the lived band, suspected classifications as a hatched rule.
private struct HatchSwatch: View {
    var color: Color = Theme.textSecondary
    var base: Color? = StripeColors.lived

    var body: some View {
        Canvas { ctx, size in
            if let base {
                ctx.fill(Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 2), with: .color(base))
            }
            ctx.clip(to: Path(CGRect(origin: .zero, size: size)))
            var x = -size.height
            while x < size.width {
                var p = Path()
                p.move(to: CGPoint(x: x, y: size.height))
                p.addLine(to: CGPoint(x: x + size.height, y: 0))
                ctx.stroke(p, with: .color(color), lineWidth: base == nil ? 1.6 : 1.4)
                x += 4
            }
        }
    }
}

/// Wraps its children onto as many lines as they need.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                y += lineHeight + lineSpacing
                x = 0
                lineHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: min(maxX, width), height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += lineHeight + lineSpacing
                x = bounds.minX
                lineHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
