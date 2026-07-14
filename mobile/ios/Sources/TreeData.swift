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
    /// Still queued in the outbox (saved on this device, not yet synced).
    var pending: Bool = false
}

/// The closed category color set from theme.css; never extended casually.
enum CategoryColors {
    static let trauma: [String: Color] = [
        "loss": Color(red: 0x81 / 255, green: 0x8c / 255, blue: 0xf8 / 255),
        "abuse": Color(red: 0xf8 / 255, green: 0x71 / 255, blue: 0x71 / 255),
        "addiction": Color(red: 0xfb / 255, green: 0xbf / 255, blue: 0x24 / 255),
        "war": Color(red: 0xa8 / 255, green: 0xa2 / 255, blue: 0x9e / 255),
        "displacement": Color(red: 0xe8 / 255, green: 0x79 / 255, blue: 0xf9 / 255),
        "illness": Color(red: 0x22 / 255, green: 0xd3 / 255, blue: 0xee / 255),
        "poverty": Color(red: 0xa7 / 255, green: 0x8b / 255, blue: 0xfa / 255),
    ]
    static let life: [String: Color] = [
        "family": Color(red: 0x60 / 255, green: 0xa5 / 255, blue: 0xfa / 255),
        "education": Color(red: 0xa7 / 255, green: 0x8b / 255, blue: 0xfa / 255),
        "career": Color(red: 0xfb / 255, green: 0xbf / 255, blue: 0x24 / 255),
        "relocation": Color(red: 0x2d / 255, green: 0xd4 / 255, blue: 0xbf / 255),
        "health": Color(red: 0xf4 / 255, green: 0x72 / 255, blue: 0xb6 / 255),
        "medication": Color(red: 0x22 / 255, green: 0xd3 / 255, blue: 0xee / 255),
        "other": Color(red: 0x94 / 255, green: 0xa3 / 255, blue: 0xb8 / 255),
    ]
    static let turningPoint = Color(red: 0x05 / 255, green: 0x96 / 255, blue: 0x69 / 255)

    static func trauma(_ category: String?) -> Color {
        trauma[category ?? ""] ?? trauma["loss"]!
    }

    static func life(_ category: String?) -> Color {
        life[category ?? ""] ?? life["other"]!
    }

    /// Classification status: amber suspected, blue diagnosed (the badge grammar).
    static func classification(_ status: String?) -> Color {
        status == "diagnosed"
            ? Color(red: 0x60 / 255, green: 0xa5 / 255, blue: 0xfa / 255)
            : Color(red: 0xfb / 255, green: 0xbf / 255, blue: 0x24 / 255)
    }
}

struct TreePerson: Identifiable {
    let id: String
    let name: String
    let birthYear: Int?
    let deathYear: Int?
    let notes: String?
    let isAdopted: Bool
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
}

enum TreeDecoding {
    private struct PersonJson: Decodable {
        let name: String
        let birth_year: Int?
        let death_year: Int?
        let notes: String?
        let is_adopted: Bool?
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
                pending: row.pendingSync
            )
        )
    }

    private struct RelationshipJson: Decodable {
        let type: String
        let periods: [Period]?

        struct Period: Decodable {
            let end_year: Int?
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
        return TreeEdge(
            id: row.id,
            sourceId: row.personIds[0],
            targetId: row.personIds[1],
            kind: kind,
            dashed: dashed
        )
    }
}
