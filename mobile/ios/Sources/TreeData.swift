import Foundation
import SwiftUI
import TraumabomenCore

/// The decrypted, render-ready tree: persons with their desktop canvas
/// positions and typed relationship edges. Read-only on the companion.
struct TreeData {
    let persons: [TreePerson]
    let edges: [TreeEdge]
    let stories: [String: PersonStory]
}

/// Everything attached to one person: the badge grammar's three shapes.
struct PersonStory {
    var trauma: [StoryItem] = []
    var life: [StoryItem] = []
    var turning: [StoryItem] = []
    var classifications: [StoryItem] = []

    var isEmpty: Bool {
        trauma.isEmpty && life.isEmpty && turning.isEmpty && classifications.isEmpty
    }
}

struct StoryItem: Identifiable {
    let id: String
    let title: String
    let description: String?
    let category: String?
    let date: String?
    /// Everyone the entry belongs to (an event can be shared).
    var personIds: [String] = []
    /// Classification periods (start year, optional end year); empty for events.
    var periods: [ClassificationPeriod] = []
    /// Still queued in the outbox (saved on this device, not yet synced).
    var pending: Bool = false
}

struct ClassificationPeriod: Hashable {
    let start: Int
    let end: Int?
}

/// The closed category color set from theme.css, in both themes (the light
/// values are darker so they hold contrast on linen). Never extended casually.
enum CategoryColors {
    private static let traumaHex: [String: (dark: UInt32, light: UInt32)] = [
        "loss": (0x818cf8, 0x6366f1),
        "abuse": (0xf87171, 0xef4444),
        "addiction": (0xfbbf24, 0xd97706),
        "war": (0xa8a29e, 0x78716c),
        "displacement": (0xe879f9, 0xc026d3),
        "illness": (0x22d3ee, 0x0891b2),
        "poverty": (0xa78bfa, 0x7c3aed),
    ]
    private static let lifeHex: [String: (dark: UInt32, light: UInt32)] = [
        "family": (0x60a5fa, 0x3b82f6),
        "education": (0xa78bfa, 0x7c3aed),
        "career": (0xfbbf24, 0xd97706),
        "relocation": (0x2dd4bf, 0x0d9488),
        "health": (0xf472b6, 0xdb2777),
        "medication": (0x22d3ee, 0x0891b2),
        "other": (0x94a3b8, 0x64748b),
    ]
    private static let turningHex: [String: (dark: UInt32, light: UInt32)] = [
        "cycle_breaking": (0x34d399, 0x059669),
        "protective_relationship": (0x60a5fa, 0x2563eb),
        "recovery": (0xa78bfa, 0x7c3aed),
        "achievement": (0xfbbf24, 0xd97706),
        "positive_change": (0x2dd4bf, 0x0d9488),
    ]

    /// The generic turning-point green, for a turning point without a category.
    static let turningPoint = Theme.adaptive(dark: 0x10b981, light: 0x059669)

    static func trauma(_ category: String?) -> Color {
        let hex = traumaHex[category ?? ""] ?? traumaHex["loss"]!
        return Theme.adaptive(dark: hex.dark, light: hex.light)
    }

    static func life(_ category: String?) -> Color {
        let hex = lifeHex[category ?? ""] ?? lifeHex["other"]!
        return Theme.adaptive(dark: hex.dark, light: hex.light)
    }

    static func turning(_ category: String?) -> Color {
        guard let hex = turningHex[category ?? ""] else { return turningPoint }
        return Theme.adaptive(dark: hex.dark, light: hex.light)
    }

    /// Classification status: amber suspected, sky blue diagnosed (the badge grammar).
    static func classification(_ status: String?) -> Color {
        status == "diagnosed"
            ? Theme.adaptive(dark: 0x38bdf8, light: 0x0284c7)
            : Theme.adaptive(dark: 0xfbbf24, light: 0xd97706)
    }
}

struct TreePerson: Identifiable {
    let id: String
    let name: String
    let birthYear: Int?
    let deathYear: Int?
    let notes: String?
    let isAdopted: Bool
    /// "female", "male", or anything else; the glance sentence's wording follows it.
    var gender: String = ""
    let x: CGFloat
    let y: CGFloat

    var yearsLabel: String {
        guard let birth = birthYear else { return "" }
        if let death = deathYear { return "\(birth) - \(death)" }
        return "\(birth) -"
    }
}

struct TreeEdge: Identifiable {
    enum Kind {
        case parent // biological: solid
        case step // step or adoptive: dashed
        case partner // pink; solid while ongoing, dashed when ended
        case sibling
        case friend
    }

    let id: String
    let sourceId: String
    let targetId: String
    let kind: Kind
    let dashed: Bool
    /// The web's relationship type ("biological_parent", "step_parent", "partner", ...).
    var type: String = ""
    /// Partner periods in start order, each with its status and end year.
    var periods: [PartnerPeriod] = []
}

struct PartnerPeriod: Hashable {
    let start: Int
    let end: Int?
    let status: String?
}

enum TreeDecoding {
    private struct PersonJson: Decodable {
        let name: String
        let birth_year: Int?
        let death_year: Int?
        let notes: String?
        let is_adopted: Bool?
        let gender: String?
        let position: Position?

        struct Position: Decodable {
            let x: Double
            let y: Double
        }
    }

    private struct StoryJson: Decodable {
        let title: String
        let description: String?
        let category: String?
        let approximate_date: String?
    }

    static func storyItem(_ row: MirrorEntry, key: AesGcmKey) -> (personIds: [String], item: StoryItem)? {
        guard
            let plaintext = try? TraumaCrypto.shared.decryptJsonFromApi(
                encryptedData: row.encryptedData, key: key
            ),
            let json = try? JSONDecoder().decode(StoryJson.self, from: Data(plaintext.utf8))
        else { return nil }
        return (
            row.personIds,
            StoryItem(
                id: row.id,
                title: json.title,
                description: json.description,
                category: json.category,
                date: json.approximate_date,
                personIds: row.personIds,
                pending: row.pendingSync
            )
        )
    }

    private struct ClassificationJson: Decodable {
        let dsm_category: String
        let dsm_subcategory: String?
        let status: String?
        let diagnosis_year: Int?
        let notes: String?
        let periods: [Period]?

        struct Period: Decodable {
            let start_year: Int
            let end_year: Int?
        }
    }

    /// A classification rendered as a story item: its title is the DSM label
    /// (subcategory if set, else category), the status drives the badge colour,
    /// the diagnosis year sits in the date slot, and notes form the description.
    static func classificationItem(_ row: MirrorEntry, key: AesGcmKey) -> (personIds: [String], item: StoryItem)? {
        guard
            let plaintext = try? TraumaCrypto.shared.decryptJsonFromApi(
                encryptedData: row.encryptedData, key: key
            ),
            let json = try? JSONDecoder().decode(ClassificationJson.self, from: Data(plaintext.utf8))
        else { return nil }
        let title = Taxonomies.dsmLabel(
            category: json.dsm_category, subcategory: json.dsm_subcategory,
            language: Loc.shared.effective
        )
        return (
            row.personIds,
            StoryItem(
                id: row.id,
                title: title,
                description: json.notes,
                category: json.status,
                date: json.diagnosis_year.map(String.init),
                personIds: row.personIds,
                periods: (json.periods ?? []).map { ClassificationPeriod(start: $0.start_year, end: $0.end_year) },
                pending: row.pendingSync
            )
        )
    }

    private struct RelationshipJson: Decodable {
        let type: String
        let periods: [Period]?

        struct Period: Decodable {
            let start_year: Int?
            let end_year: Int?
            let status: String?
        }
    }

    static func person(_ row: MirrorEntry, key: AesGcmKey, fallbackIndex: Int) -> TreePerson? {
        guard
            let plaintext = try? TraumaCrypto.shared.decryptJsonFromApi(
                encryptedData: row.encryptedData, key: key
            ),
            let json = try? JSONDecoder().decode(PersonJson.self, from: Data(plaintext.utf8))
        else { return nil }
        // Positions come from the desktop layout; a person without one gets
        // a simple grid slot rather than being hidden.
        let x = json.position?.x ?? Double(fallbackIndex % 3) * 220
        let y = json.position?.y ?? Double(fallbackIndex / 3) * 160
        return TreePerson(
            id: row.id,
            name: json.name,
            birthYear: json.birth_year,
            deathYear: json.death_year,
            notes: json.notes,
            isAdopted: json.is_adopted ?? false,
            gender: json.gender ?? "",
            x: x,
            y: y
        )
    }

    static func edge(_ row: MirrorEntry, key: AesGcmKey) -> TreeEdge? {
        // The pull maps relationship endpoints into personIds [source, target].
        guard
            row.personIds.count == 2,
            let plaintext = try? TraumaCrypto.shared.decryptJsonFromApi(
                encryptedData: row.encryptedData, key: key
            ),
            let json = try? JSONDecoder().decode(RelationshipJson.self, from: Data(plaintext.utf8))
        else { return nil }

        let kind: TreeEdge.Kind
        var dashed = false
        switch json.type {
        case "biological_parent":
            kind = .parent
        case "step_parent", "adoptive_parent":
            kind = .step
            dashed = true
        case "partner":
            kind = .partner
            let ongoing = json.periods?.contains { $0.end_year == nil } ?? false
            dashed = !ongoing
        case "friend":
            kind = .friend
            dashed = true
        default:
            kind = .sibling
            dashed = true
        }
        let periods = (json.periods ?? [])
            .map { PartnerPeriod(start: $0.start_year ?? 0, end: $0.end_year, status: $0.status) }
            .sorted { $0.start < $1.start }
        return TreeEdge(
            id: row.id,
            sourceId: row.personIds[0],
            targetId: row.personIds[1],
            kind: kind,
            dashed: dashed,
            type: json.type,
            periods: periods
        )
    }
}
