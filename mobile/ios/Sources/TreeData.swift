import Foundation
import TraumabomenCore

/// The decrypted, render-ready tree: persons with their desktop canvas
/// positions and typed relationship edges. Read-only on the companion.
struct TreeData {
    let persons: [TreePerson]
    let edges: [TreeEdge]
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
