import SwiftUI

/// The tree list's preview of the latest tree, as on the web
/// (frontend/src/lib/treeSilhouette.ts): the canvas layout in miniature,
/// reduced to people and the two lines that carry a family's shape.
struct Silhouette {
    enum LinkKind { case partner, formerPartner, parent, chosenParent }

    struct Link {
        let kind: LinkKind
        let path: Path
    }

    /// Node size in canvas units, matching the person node on the canvas.
    static let node = CGSize(width: 180, height: 80)
    private static let padding: CGFloat = 48
    private static let bioParents: Set<String> = ["biological_parent", "co_parent"]
    private static let chosenParents: Set<String> = ["adoptive_parent", "step_parent"]

    let people: [TreePerson]
    let links: [Link]
    let bounds: CGRect

    init(persons: [TreePerson], edges: [TreeEdge]) {
        people = persons
        guard !persons.isEmpty else {
            links = []
            bounds = CGRect(x: 0, y: 0, width: Self.node.width * 3, height: Self.node.height * 3)
            return
        }
        let byId = Dictionary(uniqueKeysWithValues: persons.map { ($0.id, $0) })
        var partnerPairs: Set<String> = []
        var built: [Link] = []
        for edge in edges where edge.type == "partner" {
            guard let a = byId[edge.sourceId], let b = byId[edge.targetId] else { continue }
            partnerPairs.insert(Self.pairKey(a.id, b.id))
            let (left, right) = a.x <= b.x ? (a, b) : (b, a)
            var path = Path()
            path.move(to: CGPoint(x: left.x + Self.node.width, y: left.y + Self.node.height / 2))
            path.addLine(to: CGPoint(x: right.x, y: right.y + Self.node.height / 2))
            let former = !edge.periods.isEmpty && edge.periods.allSatisfy { $0.end != nil }
            built.append(Link(kind: former ? .formerPartner : .partner, path: path))
        }

        var byChild: [String: [TreeEdge]] = [:]
        for edge in edges where Self.bioParents.contains(edge.type) || Self.chosenParents.contains(edge.type) {
            guard byId[edge.sourceId] != nil, byId[edge.targetId] != nil else { continue }
            byChild[edge.targetId, default: []].append(edge)
        }
        for (childId, rels) in byChild {
            let child = byId[childId]!
            let parents = rels.map { byId[$0.sourceId]! }
            if parents.count == 2, partnerPairs.contains(Self.pairKey(parents[0].id, parents[1].id)) {
                let kind: LinkKind = rels.allSatisfy { Self.bioParents.contains($0.type) } ? .parent : .chosenParent
                let fromX = (parents[0].x + parents[1].x + Self.node.width) / 2
                let fromY = max(parents[0].y, parents[1].y) + Self.node.height / 2
                built.append(Link(kind: kind, path: Self.elbow(from: CGPoint(x: fromX, y: fromY), to: child)))
            } else {
                for (i, parent) in parents.enumerated() {
                    let from = CGPoint(x: parent.x + Self.node.width / 2, y: parent.y + Self.node.height)
                    let kind: LinkKind = Self.chosenParents.contains(rels[i].type) ? .chosenParent : .parent
                    built.append(Link(kind: kind, path: Self.elbow(from: from, to: child)))
                }
            }
        }
        links = built

        let minX = persons.map(\.x).min()! - Self.padding
        let minY = persons.map(\.y).min()! - Self.padding
        let maxX = persons.map(\.x).max()! + Self.node.width + Self.padding
        let maxY = persons.map(\.y).max()! + Self.node.height + Self.padding
        bounds = CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// An elbow from a point above the child down to the top of the child's node.
    private static func elbow(from: CGPoint, to child: TreePerson) -> Path {
        let toX = child.x + node.width / 2
        let midY = from.y + (child.y - from.y) / 2
        var path = Path()
        path.move(to: from)
        path.addLine(to: CGPoint(x: from.x, y: midY))
        path.addLine(to: CGPoint(x: toX, y: midY))
        path.addLine(to: CGPoint(x: toX, y: child.y))
        return path
    }

    private static func pairKey(_ a: String, _ b: String) -> String { a < b ? "\(a)|\(b)" : "\(b)|\(a)" }
}

/// The silhouette drawn read-only: miniature nodes with the accent top edge,
/// names in the voice face, partner lines in the partner colour, parent lines
/// elbowed from the couple, dashed for chosen parents and former partners.
struct SilhouetteView: View {
    let silhouette: Silhouette

    private static let partner = Color(red: 0xec / 255, green: 0x48 / 255, blue: 0x99 / 255)

    var body: some View {
        Canvas { ctx, size in
            let b = silhouette.bounds
            let scale = min(size.width / b.width, size.height / b.height)
            ctx.translateBy(x: (size.width - b.width * scale) / 2, y: (size.height - b.height * scale) / 2)
            ctx.scaleBy(x: scale, y: scale)
            ctx.translateBy(x: -b.minX, y: -b.minY)

            for link in silhouette.links {
                let dashed = link.kind == .formerPartner || link.kind == .chosenParent
                let color: Color = (link.kind == .partner || link.kind == .formerPartner) ? Self.partner : Theme.textMuted
                ctx.stroke(link.path, with: .color(color.opacity(0.85)),
                           style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round, dash: dashed ? [10, 8] : []))
            }
            for person in silhouette.people {
                let rect = CGRect(x: person.x, y: person.y, width: Silhouette.node.width, height: Silhouette.node.height)
                let card = Path(roundedRect: rect, cornerRadius: 12)
                ctx.fill(card, with: .color(Theme.bgSecondary))
                ctx.stroke(card, with: .color(Theme.borderPrimary), lineWidth: 2)
                ctx.fill(Path(roundedRect: CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: 6),
                              cornerRadius: 3), with: .color(Theme.accent))
                ctx.draw(
                    Text(person.name.split(separator: " ").first.map(String.init) ?? person.name)
                        .font(Theme.heading(30))
                        .foregroundStyle(Theme.textPrimary),
                    at: CGPoint(x: rect.midX, y: rect.midY + 3)
                )
            }
        }
        .accessibilityHidden(true)
    }
}
