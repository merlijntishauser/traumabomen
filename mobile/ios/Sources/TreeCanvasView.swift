import SwiftUI

/// The read-only tree canvas: nodes at their desktop positions, edges in the
/// web's visual grammar (solid biological, dashed step, pink partners that
/// dash when the relationship ended). Pinch to zoom, drag to pan, tap a
/// person for their page. Editing points to the desk, by design.
struct TreeCanvasView: View {
    let data: TreeData

    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var drag: CGSize = .zero
    @State private var selected: TreePerson?

    private static let nodeSize = CGSize(width: 170, height: 62)

    var body: some View {
        GeometryReader { geo in
            let fit = fitTransform(in: geo.size)
            let effectiveZoom = zoom * pinch
            let effectivePan = CGSize(width: pan.width + drag.width, height: pan.height + drag.height)

            Canvas { ctx, _ in
                ctx.translateBy(x: effectivePan.width, y: effectivePan.height)
                ctx.scaleBy(x: fit.scale * effectiveZoom, y: fit.scale * effectiveZoom)
                ctx.translateBy(x: fit.offset.width, y: fit.offset.height)

                drawEdges(in: &ctx)
                drawNodes(in: &ctx)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .updating($drag) { value, state, _ in state = value.translation }
                    .onEnded { value in
                        pan.width += value.translation.width
                        pan.height += value.translation.height
                    }
            )
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinch) { value, state, _ in state = value }
                    .onEnded { value in zoom = max(0.3, min(4, zoom * value)) }
            )
            .onTapGesture { location in
                let contentPoint = CGPoint(
                    x: ((location.x - effectivePan.width) / (fit.scale * effectiveZoom)) - fit.offset.width,
                    y: ((location.y - effectivePan.height) / (fit.scale * effectiveZoom)) - fit.offset.height
                )
                selected = data.persons.first { person in
                    CGRect(origin: CGPoint(x: person.x, y: person.y), size: Self.nodeSize)
                        .insetBy(dx: -6, dy: -6)
                        .contains(contentPoint)
                }
            }
        }
        .sheet(item: $selected) { PersonSheet(person: $0) }
    }

    // Center the tree's bounding box in the viewport at a readable scale.
    private func fitTransform(in size: CGSize) -> (scale: CGFloat, offset: CGSize) {
        guard let minX = data.persons.map(\.x).min(),
              let minY = data.persons.map(\.y).min(),
              let maxX = data.persons.map({ $0.x + Self.nodeSize.width }).max(),
              let maxY = data.persons.map({ $0.y + Self.nodeSize.height }).max()
        else { return (1, .zero) }

        let margin: CGFloat = 32
        let width = maxX - minX
        let height = maxY - minY
        let scale = min(
            (size.width - margin * 2) / max(width, 1),
            (size.height - margin * 2) / max(height, 1),
            1.2
        )
        let offset = CGSize(
            width: -minX + (size.width / scale - width) / 2,
            height: -minY + (size.height / scale - height) / 2
        )
        return (scale, offset)
    }

    private func drawEdges(in ctx: inout GraphicsContext) {
        let byId = Dictionary(uniqueKeysWithValues: data.persons.map { ($0.id, $0) })
        for edge in data.edges {
            guard let source = byId[edge.sourceId], let target = byId[edge.targetId] else { continue }

            var path = Path()
            let color: Color
            var width: CGFloat = 1.5

            switch edge.kind {
            case .partner, .friend, .sibling:
                // Side to side between the facing edges of the two nodes.
                let (left, right) = source.x <= target.x ? (source, target) : (target, source)
                let from = CGPoint(x: left.x + Self.nodeSize.width, y: left.y + Self.nodeSize.height / 2)
                let to = CGPoint(x: right.x, y: right.y + Self.nodeSize.height / 2)
                path.move(to: from)
                path.addCurve(
                    to: to,
                    control1: CGPoint(x: (from.x + to.x) / 2, y: from.y),
                    control2: CGPoint(x: (from.x + to.x) / 2, y: to.y)
                )
                color = edge.kind == .partner
                    ? Color(red: 0xec / 255, green: 0x48 / 255, blue: 0x99 / 255)
                    : edge.kind == .friend
                        ? Color(red: 0xe8 / 255, green: 0x86 / 255, blue: 0x3a / 255)
                        : Color(red: 0xa8 / 255, green: 0x55 / 255, blue: 0xf7 / 255)
                if edge.kind == .partner, !edge.dashed { width = 2.5 }
            case .parent, .step:
                // Parent bottom to child top; a simple vertical bezier. The
                // web's shared family-connector buses are a later refinement.
                let from = CGPoint(x: source.x + Self.nodeSize.width / 2, y: source.y + Self.nodeSize.height)
                let to = CGPoint(x: target.x + Self.nodeSize.width / 2, y: target.y)
                path.move(to: from)
                path.addCurve(
                    to: to,
                    control1: CGPoint(x: from.x, y: (from.y + to.y) / 2),
                    control2: CGPoint(x: to.x, y: (from.y + to.y) / 2)
                )
                color = edge.kind == .parent
                    ? Color(red: 0x8f / 255, green: 0xaa / 255, blue: 0x97 / 255)
                    : Color(red: 0x5a / 255, green: 0x7a / 255, blue: 0x64 / 255)
            }

            let style = StrokeStyle(
                lineWidth: width,
                lineCap: .round,
                dash: edge.dashed ? [6, 4] : []
            )
            ctx.stroke(path, with: .color(color), style: style)
        }
    }

    private func drawNodes(in ctx: inout GraphicsContext) {
        for person in data.persons {
            let rect = CGRect(origin: CGPoint(x: person.x, y: person.y), size: Self.nodeSize)
            let card = Path(roundedRect: rect, cornerRadius: 10)
            ctx.fill(card, with: .color(Theme.bgSecondary))
            ctx.stroke(card, with: .color(Theme.borderPrimary), lineWidth: 1)

            ctx.draw(
                Text(person.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary),
                at: CGPoint(x: rect.minX + 12, y: rect.minY + 16),
                anchor: .leading
            )
            ctx.draw(
                Text(person.yearsLabel)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.textMuted),
                at: CGPoint(x: rect.minX + 12, y: rect.minY + 38),
                anchor: .leading
            )
        }
    }
}

/// A person's page: their years and notes, read-only. The full story
/// (events, classifications, turning points) joins in a later slice.
struct PersonSheet: View {
    let person: TreePerson

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 12) {
                Text(person.name)
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(Theme.textPrimary)
                    .padding(.top, 28)

                Text(person.yearsLabel)
                    .font(.system(size: Theme.bodySize))
                    .foregroundStyle(Theme.textMuted)

                if person.isAdopted {
                    Text("Adopted")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textMuted)
                }

                if let notes = person.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.system(size: Theme.bodySize))
                        .foregroundStyle(Theme.textPrimary)
                        .padding(.top, 8)
                }

                Spacer()

                Text("Editing happens at the desk; the phone is for looking and writing.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.bottom, 16)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
