import Foundation
import TraumabomenCore

/// The person page read in order, as on the web (frontend/src/lib/lifeline.ts
/// and personGlance.ts): every trauma event, life event, classification and
/// turning point on one line from birth to death, long silences named, and the
/// people around them in one glance sentence. Pure, so the rules are testable.

enum StoryKind: String, CaseIterable {
    case trauma = "trauma_event"
    case life = "life_event"
    case classification
    case turning = "turning_point"

    /// The order kinds sort within one year.
    var rank: Int {
        switch self {
        case .trauma: 0
        case .life: 1
        case .classification: 2
        case .turning: 3
        }
    }

    var editKind: StoryEditTarget.Kind {
        switch self {
        case .trauma: .trauma
        case .life: .life
        case .classification: .classification
        case .turning: .turning
        }
    }
}

struct LifelineEntry: Identifiable {
    let kind: StoryKind
    let item: StoryItem
    /// Where the entry sits on the line; nil when it has no year to place.
    let year: Int?
    /// A classification's last year, nil while ongoing.
    var endYear: Int?

    var id: String { "\(kind.rawValue)-\(item.id)" }
}

enum LifelineRow: Identifiable {
    case birth(Int)
    case entry(LifelineEntry)
    case gap(years: Int, fromYear: Int)
    case death(Int)

    var id: String {
        switch self {
        case .birth(let y): "birth-\(y)"
        case .entry(let e): e.id
        case .gap(_, let from): "gap-\(from)"
        case .death(let y): "death-\(y)"
        }
    }
}

enum Lifeline {
    /// Years without a recorded entry before the line names the silence.
    static let gapYears = 15

    /// The year an event sits at for this person, read the way the timeline reads it.
    static func year(of date: String?, birthYear: Int?) -> Int? {
        guard let reading = DateReader.shared.read(text: date) else { return nil }
        let span = DateReader.shared.yearsFor(reading: reading, birthYear: birthYear.map { KotlinInt(int: Int32($0)) })
        return span.map { Int($0.from) }
    }

    /// A classification's first year: its earliest period, else its diagnosis year.
    static func classificationStart(_ item: StoryItem) -> Int? {
        if let first = item.periods.map(\.start).min() { return first }
        return item.date.flatMap { Int($0) }
    }

    /// A classification's last year; nil when any period is ongoing or none exist.
    static func classificationEnd(_ item: StoryItem) -> Int? {
        guard !item.periods.isEmpty, item.periods.allSatisfy({ $0.end != nil }) else { return nil }
        return item.periods.compactMap(\.end).max()
    }

    /// All of a person's entries: dated ones in year order, undated ones last.
    static func entries(_ story: PersonStory, birthYear: Int?) -> [LifelineEntry] {
        var out: [LifelineEntry] = []
        out += story.trauma.map { LifelineEntry(kind: .trauma, item: $0, year: year(of: $0.date, birthYear: birthYear)) }
        out += story.life.map { LifelineEntry(kind: .life, item: $0, year: year(of: $0.date, birthYear: birthYear)) }
        out += story.turning.map { LifelineEntry(kind: .turning, item: $0, year: year(of: $0.date, birthYear: birthYear)) }
        out += story.classifications.map {
            LifelineEntry(kind: .classification, item: $0, year: classificationStart($0), endYear: classificationEnd($0))
        }
        return out.sorted { a, b in
            switch (a.year, b.year) {
            case let (ya?, yb?) where ya != yb: return ya < yb
            case (nil, _?): return false
            case (_?, nil): return true
            default: return a.kind.rank < b.kind.rank
            }
        }
    }

    /// Birth, the dated entries with a silence row wherever `gapYears` or more
    /// pass without one, then death. Undated entries come back separately.
    static func rows(_ entries: [LifelineEntry], birthYear: Int?, deathYear: Int?)
        -> (rows: [LifelineRow], undated: [LifelineEntry]) {
        var rows: [LifelineRow] = []
        var undated: [LifelineEntry] = []
        if let birthYear { rows.append(.birth(birthYear)) }
        var previous: Int?
        for entry in entries {
            guard let year = entry.year else {
                undated.append(entry)
                continue
            }
            if let previous, year - previous >= gapYears {
                rows.append(.gap(years: year - previous, fromYear: previous))
            }
            rows.append(.entry(entry))
            previous = year
        }
        if let deathYear { rows.append(.death(deathYear)) }
        return (rows, undated)
    }
}

// MARK: - The glance sentence

enum GlanceRole: String, CaseIterable {
    case marriedTo, partnerOf, formerPartnerOf, childOf, stepChildOf, parentOf, stepParentOf,
         siblingOf, halfSiblingOf, stepSiblingOf, friendOf
}

struct GlanceGroup: Equatable {
    let role: GlanceRole
    var personIds: [String]
}

enum Glance {
    private static let parentTypes: Set<String> = ["biological_parent", "co_parent", "adoptive_parent"]
    private static let siblingTypes: Set<String> = ["biological_sibling", "step_sibling", "half_sibling"]

    private static func partnerRole(_ edge: TreeEdge) -> GlanceRole {
        guard let latest = edge.periods.last else { return .partnerOf }
        if latest.end != nil || latest.status == "separated" || latest.status == "divorced" {
            return .formerPartnerOf
        }
        return latest.status == "married" ? .marriedTo : .partnerOf
    }

    /// The role the other person plays, phrased from `personId`'s side.
    private static func role(_ edge: TreeEdge, for personId: String) -> GlanceRole {
        let isSource = edge.sourceId == personId
        if parentTypes.contains(edge.type) { return isSource ? .parentOf : .childOf }
        switch edge.type {
        case "step_parent": return isSource ? .stepParentOf : .stepChildOf
        case "partner": return partnerRole(edge)
        case "half_sibling": return .halfSiblingOf
        case "step_sibling": return .stepSiblingOf
        case "friend": return .friendOf
        default: return .siblingOf
        }
    }

    /// Siblings nobody drew: two people sharing biological parents (one shared parent makes half-siblings).
    static func inferredSiblings(_ edges: [TreeEdge]) -> [(a: String, b: String, half: Bool)] {
        var parentsOf: [String: Set<String>] = [:]
        var explicit: Set<String> = []
        for edge in edges {
            if edge.type == "biological_parent" { parentsOf[edge.targetId, default: []].insert(edge.sourceId) }
            if siblingTypes.contains(edge.type) { explicit.insert(pairKey(edge.sourceId, edge.targetId)) }
        }
        let children = parentsOf.keys.sorted()
        var out: [(String, String, Bool)] = []
        for (i, a) in children.enumerated() {
            for b in children[(i + 1)...] {
                let shared = parentsOf[a]!.intersection(parentsOf[b]!)
                guard !shared.isEmpty, !explicit.contains(pairKey(a, b)) else { continue }
                out.append((a, b, shared.count < 2))
            }
        }
        return out
    }

    /// A person's relationships and inferred siblings grouped into glance roles, in reading order.
    static func groups(for personId: String, edges: [TreeEdge]) -> [GlanceGroup] {
        var byRole: [GlanceRole: [String]] = [:]
        func add(_ role: GlanceRole, _ other: String) {
            if !(byRole[role]?.contains(other) ?? false) { byRole[role, default: []].append(other) }
        }
        for edge in edges where edge.sourceId == personId || edge.targetId == personId {
            add(role(edge, for: personId), edge.sourceId == personId ? edge.targetId : edge.sourceId)
        }
        for sibling in inferredSiblings(edges) where sibling.a == personId || sibling.b == personId {
            add(sibling.half ? .halfSiblingOf : .siblingOf, sibling.a == personId ? sibling.b : sibling.a)
        }
        return GlanceRole.allCases.compactMap { role in
            byRole[role].map { GlanceGroup(role: role, personIds: $0) }
        }
    }

    private static func pairKey(_ a: String, _ b: String) -> String { a < b ? "\(a)|\(b)" : "\(b)|\(a)" }
}
