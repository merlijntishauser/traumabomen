import Foundation
import TraumabomenCore

/// The timeline as family stripes, as on the web (frontend/src/lib/familyStripes.ts
/// and generations.ts): every life is one band of whole-year cells, read one
/// year (or one age) at a time. Pure, so layout and reading rules are testable.

enum StripeMode: String, CaseIterable { case years, age }

struct StripeSpan: Hashable {
    let from: Int
    let to: Int
}

struct StripeEntry: Identifiable {
    let id: String
    let kind: StoryKind
    /// Category for events; status ("suspected"/"diagnosed") for classifications.
    let category: String
    let title: String
    let personIds: [String]
    var spans: [StripeSpan]
    let approx: Bool
    /// Set when the date is an age or stage of life: spans are filled per person.
    var relative: DateReading?

    func covers(_ year: Int) -> Bool { spans.contains { year >= $0.from && year <= $0.to } }

    /// The span covering a year, else the first.
    func span(at year: Int) -> StripeSpan? { spans.first { year >= $0.from && year <= $0.to } ?? spans.first }

    var keyId: String { "\(kind.rawValue):\(category)" }
}

struct StripeRow: Identifiable {
    let person: TreePerson
    let generation: Int
    let born: Int
    let last: Int
    /// No death year and too old to still be living: where the band ends is a guess.
    let endUnknown: Bool

    var id: String { person.id }
}

struct StripeLayout {
    var generations: [(generation: Int, rows: [StripeRow])]
    var rows: [StripeRow]
    /// People without a birth year: they cannot be placed.
    var unplaced: [TreePerson]
}

struct ReadingBlock: Identifiable {
    var people: [StripeRow]
    /// The year each person was in (all equal in years mode).
    var years: [Int]
    let entries: [StripeEntry]

    var id: String { people.map(\.person.id).joined(separator: ",") }
}

struct StripeReading {
    var blocks: [ReadingBlock] = []
    var quiet: [StripeRow] = []
    var notYet: [StripeRow] = []
    var gone: [StripeRow] = []
}

struct TraumaRun {
    let start: Int
    let end: Int
    let entries: [StripeEntry]
}

enum FamilyStripes {
    /// Oldest age a person without a death year is still drawn as living.
    static let maxLivingAge = 105
    /// Where a band ends when the death year is unknown and the person cannot be living.
    static let assumedLifespan = 80

    // MARK: Generations

    private static let parentTypes: Set<String> = ["biological_parent", "step_parent", "adoptive_parent"]

    /// Parents one generation above their children; partners and co-parents share one.
    static func generations(persons: [TreePerson], edges: [TreeEdge]) -> [String: Int] {
        let known = Set(persons.map(\.id))
        var parentsOf: [String: [String]] = [:]
        for edge in edges where parentTypes.contains(edge.type) {
            parentsOf[edge.targetId, default: []].append(edge.sourceId)
        }
        var generation: [String: Int] = [:]
        func base(_ id: String, _ visiting: inout Set<String>) -> Int {
            if let g = generation[id] { return g }
            if visiting.contains(id) { return 0 }
            visiting.insert(id)
            let parents = (parentsOf[id] ?? []).filter { known.contains($0) }
            let g = parents.isEmpty ? 0 : parents.map { base($0, &visiting) }.max()! + 1
            generation[id] = g
            return g
        }
        for person in persons {
            var visiting: Set<String> = []
            _ = base(person.id, &visiting)
        }
        var changed = true
        var guardCount = 0
        while changed, guardCount < 100 {
            changed = false
            guardCount += 1
            for edge in edges where edge.type == "partner" {
                guard let a = generation[edge.sourceId], let b = generation[edge.targetId], a != b else { continue }
                generation[edge.sourceId] = max(a, b)
                generation[edge.targetId] = max(a, b)
                changed = true
            }
            for parents in parentsOf.values where parents.count >= 2 {
                let gens = parents.compactMap { generation[$0] }
                guard gens.count >= 2, let top = gens.max() else { continue }
                for p in parents where (generation[p] ?? top) < top {
                    generation[p] = top
                    changed = true
                }
            }
            for (child, parents) in parentsOf {
                let gens = parents.compactMap { generation[$0] }
                guard let top = gens.max() else { continue }
                if top + 1 > (generation[child] ?? 0) {
                    generation[child] = top + 1
                    changed = true
                }
            }
        }
        return generation
    }

    /// Everyone in the family; people only connected as friends stay off the timeline.
    static func familyPersons(_ persons: [TreePerson], edges: [TreeEdge]) -> [TreePerson] {
        guard !edges.isEmpty else { return persons }
        var family: Set<String> = []
        var anyEdge: Set<String> = []
        for edge in edges {
            anyEdge.formUnion([edge.sourceId, edge.targetId])
            if edge.type != "friend" { family.formUnion([edge.sourceId, edge.targetId]) }
        }
        return persons.filter { family.contains($0.id) || !anyEdge.contains($0.id) }
    }

    // MARK: Layout

    static func lastYear(of person: TreePerson, now: Int) -> (last: Int, endUnknown: Bool) {
        let born = person.birthYear!
        if let death = person.deathYear { return (death, false) }
        if now - born <= maxLivingAge { return (now, false) }
        return (born + assumedLifespan, true)
    }

    static func layout(persons: [TreePerson], generations: [String: Int], now: Int) -> StripeLayout {
        var unplaced: [TreePerson] = []
        var byGen: [Int: [StripeRow]] = [:]
        for person in persons {
            guard let born = person.birthYear else {
                unplaced.append(person)
                continue
            }
            let generation = generations[person.id] ?? 0
            let (last, endUnknown) = lastYear(of: person, now: now)
            byGen[generation, default: []].append(
                StripeRow(person: person, generation: generation, born: born, last: last, endUnknown: endUnknown)
            )
        }
        let groups = byGen.keys.sorted().map { g in
            (generation: g, rows: byGen[g]!.sorted {
                $0.born != $1.born ? $0.born < $1.born : $0.person.name.localizedCompare($1.person.name) == .orderedAscending
            })
        }
        unplaced.sort { $0.name.localizedCompare($1.name) == .orderedAscending }
        return StripeLayout(generations: groups, rows: groups.flatMap(\.rows), unplaced: unplaced)
    }

    /// First year of the years ruler: a decade boundary before the earliest birth.
    static func yearStart(_ rows: [StripeRow], now: Int) -> Int {
        let earliest = rows.map(\.born).min() ?? now
        return Int((Double(earliest - 1) / 10).rounded(.down)) * 10
    }

    /// Ages shown in age mode: the oldest age reached, plus room, rounded to a decade.
    static func ageSpan(_ rows: [StripeRow]) -> Int {
        let oldest = rows.map { $0.last - $0.born }.max() ?? 0
        return max(30, Int((Double(oldest + 6) / 10).rounded(.up)) * 10)
    }

    // MARK: Entries

    /// Every entry the stripes can place, from the decrypted stories (deduplicated across people).
    static func entries(from stories: [String: PersonStory], now: Int) -> [StripeEntry] {
        var seen: Set<String> = []
        var out: [StripeEntry] = []
        func add(_ kind: StoryKind, _ item: StoryItem) {
            guard seen.insert("\(kind.rawValue)-\(item.id)").inserted else { return }
            if kind == .classification {
                var spans = item.periods.map { StripeSpan(from: $0.start, to: $0.end ?? now) }
                if spans.isEmpty, let diagnosed = item.date.flatMap({ Int($0) }) {
                    spans = [StripeSpan(from: diagnosed, to: now)]
                }
                guard !spans.isEmpty else { return }
                out.append(StripeEntry(id: item.id, kind: kind, category: item.category ?? "suspected",
                                       title: item.title, personIds: item.personIds, spans: spans, approx: false))
                return
            }
            guard let reading = DateReader.shared.read(text: item.date) else { return }
            let base = (id: item.id, category: item.category ?? "", title: item.title, people: item.personIds)
            if reading.kind == .years {
                out.append(StripeEntry(id: base.id, kind: kind, category: base.category, title: base.title,
                                       personIds: base.people,
                                       spans: [StripeSpan(from: Int(reading.from), to: Int(reading.to))],
                                       approx: reading.approx))
            } else {
                out.append(StripeEntry(id: base.id, kind: kind, category: base.category, title: base.title,
                                       personIds: base.people, spans: [], approx: reading.kind == .ages,
                                       relative: reading))
            }
        }
        for story in stories.values {
            story.trauma.forEach { add(.trauma, $0) }
            story.life.forEach { add(.life, $0) }
            story.turning.forEach { add(.turning, $0) }
            story.classifications.forEach { add(.classification, $0) }
        }
        return out.sorted { $0.id < $1.id }
    }

    /// Each person's entries, with ages and two-digit years resolved to their own years.
    static func byPerson(_ rows: [StripeRow], _ entries: [StripeEntry]) -> [String: [StripeEntry]] {
        var born: [String: Int] = [:]
        var out: [String: [StripeEntry]] = [:]
        for row in rows {
            born[row.person.id] = row.born
            out[row.person.id] = []
        }
        for entry in entries {
            for id in entry.personIds where out[id] != nil {
                guard let relative = entry.relative else {
                    out[id]!.append(entry)
                    continue
                }
                let span = DateReader.shared.yearsFor(
                    reading: relative, birthYear: born[id].map { KotlinInt(int: Int32($0)) }
                )
                if let span {
                    var resolved = entry
                    resolved.spans = [StripeSpan(from: Int(span.from), to: Int(span.to))]
                    out[id]!.append(resolved)
                }
            }
        }
        return out
    }

    /// Consecutive years with the same set of trauma events, clipped to a life.
    static func traumaRuns(_ mine: [StripeEntry], born: Int, last: Int) -> [TraumaRun] {
        let traumas = mine.filter { $0.kind == .trauma }
        guard !traumas.isEmpty, last >= born else { return [] }
        var runs: [TraumaRun] = []
        var current: (key: String, start: Int, end: Int, entries: [StripeEntry])?
        for year in born...last {
            let here = traumas.filter { $0.covers(year) }
            let key = here.map(\.id).joined(separator: ",")
            if let c = current, c.key == key {
                current!.end = year
                continue
            }
            if let c = current, !c.entries.isEmpty { runs.append(TraumaRun(start: c.start, end: c.end, entries: c.entries)) }
            current = (key, year, year, here)
        }
        if let c = current, !c.entries.isEmpty { runs.append(TraumaRun(start: c.start, end: c.end, entries: c.entries)) }
        return runs
    }

    static func clip(_ span: StripeSpan, born: Int, last: Int) -> StripeSpan? {
        let from = max(span.from, born)
        let to = min(span.to, last)
        return to < from ? nil : StripeSpan(from: from, to: to)
    }

    // MARK: Reading

    private static func year(for row: StripeRow, mode: StripeMode, value: Int) -> Int {
        mode == .years ? value : row.born + value
    }

    /// What one year (or age) held for everyone. In years mode, people whose
    /// year held exactly the same entries share one block.
    static func read(_ rows: [StripeRow], _ entries: [StripeEntry], mode: StripeMode, value: Int, now: Int) -> StripeReading {
        var reading = StripeReading()
        let mine = byPerson(rows, entries)
        var blockIndex: [String: Int] = [:]
        for row in rows {
            let year = year(for: row, mode: mode, value: value)
            if year < row.born || year > now {
                reading.notYet.append(row)
                continue
            }
            if year > row.last {
                reading.gone.append(row)
                continue
            }
            let held = (mine[row.person.id] ?? []).filter { $0.covers(year) }
            if held.isEmpty {
                reading.quiet.append(row)
                continue
            }
            let key = held.map(\.id).joined(separator: ",")
            if mode == .years, let index = blockIndex[key] {
                reading.blocks[index].people.append(row)
                reading.blocks[index].years.append(year)
                continue
            }
            blockIndex[key] = reading.blocks.count
            reading.blocks.append(ReadingBlock(people: [row], years: [year], entries: held))
        }
        return reading
    }

    /// The year (or age) to open on: the one that holds the most, latest on a tie.
    static func busiest(_ rows: [StripeRow], _ entries: [StripeEntry], mode: StripeMode, min: Int, max: Int, now: Int) -> Int {
        let mine = byPerson(rows, entries)
        var best = max
        var bestWeight = -1
        guard min <= max else { return max }
        for v in min...max {
            var weight = 0
            for row in rows {
                let y = year(for: row, mode: mode, value: v)
                guard y >= row.born, y <= Swift.min(row.last, now) else { continue }
                weight += (mine[row.person.id] ?? []).filter { $0.covers(y) }.count
            }
            if weight >= bestWeight {
                best = v
                bestWeight = weight
            }
        }
        return best
    }

    // MARK: Highlighting

    /// An entry lights up with every entry of the same title.
    static func match(entry id: String, in entries: [StripeEntry]) -> Set<String> {
        guard let source = entries.first(where: { $0.id == id }) else { return [] }
        let title = source.title.trimmingCharacters(in: .whitespaces).lowercased()
        return Set(entries.filter { $0.title.trimmingCharacters(in: .whitespaces).lowercased() == title }.map(\.id))
    }

    /// A key item lights up every entry it describes ("approx" for approximate dates).
    static func match(key: String, in entries: [StripeEntry]) -> Set<String> {
        Set(entries.filter { key == "approx" ? $0.approx : $0.keyId == key }.map(\.id))
    }

    // MARK: Undated

    /// How many of each person's entries have no year to place.
    static func undatedCounts(_ stories: [String: PersonStory]) -> [String: Int] {
        var counts: [String: Int] = [:]
        for (personId, story) in stories {
            let events = story.trauma + story.life + story.turning
            var count = events.filter { DateReader.shared.read(text: $0.date) == nil }.count
            count += story.classifications.filter { $0.periods.isEmpty && Int($0.date ?? "") == nil }.count
            if count > 0 { counts[personId] = count }
        }
        return counts
    }
}
