import SwiftUI

/// The read-only tree canvas: nodes at their desktop positions, edges in the
/// web's visual grammar (solid biological, dashed step, pink partners that
/// dash when the relationship ended). Pinch to zoom, drag to pan, tap a
/// person for their page. Editing points to the desk, by design.
struct TreeCanvasView: View {
    let data: TreeData

    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @GestureState private var drag: CGSize = .zero
    @State private var selected: TreePerson?

    // Pinch focal-zoom bookkeeping: captured at the start of a pinch so the
    // point under the fingers stays put, instead of the tree scaling away
    // from the origin.
    @State private var pinchAnchor: CGPoint?
    @State private var zoomAtPinchStart: CGFloat = 1
    @State private var panAtPinchStart: CGSize = .zero

    private static let nodeSize = CGSize(width: 170, height: 62)

    var body: some View {
        GeometryReader { geo in
            let fit = fitTransform(in: geo.size)
            let scale = fit.scale * zoom
            let effectivePan = CGSize(width: pan.width + drag.width, height: pan.height + drag.height)

            Canvas { ctx, _ in
                ctx.translateBy(x: effectivePan.width, y: effectivePan.height)
                ctx.scaleBy(x: scale, y: scale)
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
                MagnifyGesture()
                    .onChanged { value in
                        // Capture the anchor (the midpoint between the fingers)
                        // and the transform at the pinch's start.
                        if pinchAnchor == nil {
                            pinchAnchor = value.startLocation
                            zoomAtPinchStart = zoom
                            panAtPinchStart = pan
                        }
                        guard let anchor = pinchAnchor else { return }
                        let clamped = max(0.3, min(4, zoomAtPinchStart * value.magnification))
                        // Zoom about the anchor: solve for the pan that keeps the
                        // content point under the anchor stationary (fit.scale
                        // cancels, so only the zoom ratio matters).
                        let m = clamped / zoomAtPinchStart
                        zoom = clamped
                        pan = CGSize(
                            width: anchor.x * (1 - m) + m * panAtPinchStart.width,
                            height: anchor.y * (1 - m) + m * panAtPinchStart.height
                        )
                    }
                    .onEnded { _ in pinchAnchor = nil }
            )
            .onTapGesture { location in
                let contentPoint = CGPoint(
                    x: ((location.x - effectivePan.width) / scale) - fit.offset.width,
                    y: ((location.y - effectivePan.height) / scale) - fit.offset.height
                )
                selected = data.persons.first { person in
                    CGRect(origin: CGPoint(x: person.x, y: person.y), size: Self.nodeSize)
                        .insetBy(dx: -6, dy: -6)
                        .contains(contentPoint)
                }
            }
            // A soft vignette so the tree floats on the atmosphere rather than
            // sitting on a hard edge.
            .overlay(
                RadialGradient(
                    colors: [.clear, .clear, Theme.bgPrimary.opacity(0.5)],
                    center: .center,
                    startRadius: geo.size.width * 0.35,
                    endRadius: geo.size.width * 0.95
                )
                .allowsHitTesting(false)
            )
        }
        .sheet(item: $selected) { person in
            PersonSheet(person: person, story: data.stories[person.id] ?? PersonStory())
        }
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

    private static let parentColor = Color(red: 0x8f / 255, green: 0xaa / 255, blue: 0x97 / 255)
    private static let stepColor = Color(red: 0x5a / 255, green: 0x7a / 255, blue: 0x64 / 255)

    private func drawEdges(in ctx: inout GraphicsContext) {
        let byId = Dictionary(uniqueKeysWithValues: data.persons.map { ($0.id, $0) })

        // Side relationships (partner, friend, sibling) stay as facing-edge
        // curves; parent edges route through shared family-connector buses.
        for edge in data.edges {
            guard edge.kind == .partner || edge.kind == .friend || edge.kind == .sibling,
                  let source = byId[edge.sourceId], let target = byId[edge.targetId] else { continue }

            let (left, right) = source.x <= target.x ? (source, target) : (target, source)
            let from = CGPoint(x: left.x + Self.nodeSize.width, y: left.y + Self.nodeSize.height / 2)
            let to = CGPoint(x: right.x, y: right.y + Self.nodeSize.height / 2)
            var path = Path()
            path.move(to: from)
            path.addCurve(
                to: to,
                control1: CGPoint(x: (from.x + to.x) / 2, y: from.y),
                control2: CGPoint(x: (from.x + to.x) / 2, y: to.y)
            )
            let color = edge.kind == .partner
                ? Color(red: 0xec / 255, green: 0x48 / 255, blue: 0x99 / 255)
                : edge.kind == .friend
                    ? Color(red: 0xe8 / 255, green: 0x86 / 255, blue: 0x3a / 255)
                    : Color(red: 0xa8 / 255, green: 0x55 / 255, blue: 0xf7 / 255)
            let width: CGFloat = (edge.kind == .partner && !edge.dashed) ? 2.5 : 1.5
            ctx.stroke(path, with: .color(color),
                       style: StrokeStyle(lineWidth: width, lineCap: .round, dash: edge.dashed ? [6, 4] : []))
        }

        drawFamilyConnectors(byId: byId, in: &ctx)
    }

    /// Route parent edges as the web does: co-parents of the same children
    /// share one horizontal bus. Each parent drops to the bus (rounded
    /// corner), the bus spans them, and each child drops from the bus to its
    /// top. Grouped by the exact set of parents so half-siblings split off.
    private func drawFamilyConnectors(byId: [String: TreePerson], in ctx: inout GraphicsContext) {
        // child -> its parent ids, and whether any of those edges is step.
        var parentsOf: [String: (parents: [String], stepped: Bool)] = [:]
        for edge in data.edges where edge.kind == .parent || edge.kind == .step {
            var entry = parentsOf[edge.targetId] ?? ([], false)
            entry.parents.append(edge.sourceId)
            if edge.kind == .step { entry.stepped = true }
            parentsOf[edge.targetId] = entry
        }

        // Group children by their sorted parent-set (the family unit).
        struct Unit { var children: [String]; var stepped: Bool }
        var units: [String: Unit] = [:]
        for (child, info) in parentsOf {
            let key = info.parents.sorted().joined(separator: "|")
            var u = units[key] ?? Unit(children: [], stepped: false)
            u.children.append(child)
            if info.stepped { u.stepped = true }
            units[key] = u
        }

        for (key, unit) in units {
            let parents = key.split(separator: "|").compactMap { byId[String($0)] }
            let children = unit.children.compactMap { byId[$0] }
            guard !parents.isEmpty, !children.isEmpty else { continue }

            let parentBottom = parents.map { $0.y + Self.nodeSize.height }.max()!
            let childTop = children.map(\.y).min()!
            let busY = (parentBottom + childTop) / 2

            let parentXs = parents.map { $0.x + Self.nodeSize.width / 2 }
            let childXs = children.map { $0.x + Self.nodeSize.width / 2 }
            let color = unit.stepped ? Self.stepColor : Self.parentColor
            let style = StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round,
                                    dash: unit.stepped ? [6, 4] : [])

            // The horizontal bus spans every drop point.
            var bus = Path()
            let minX = (parentXs + childXs).min()!
            let maxX = (parentXs + childXs).max()!
            bus.move(to: CGPoint(x: minX, y: busY))
            bus.addLine(to: CGPoint(x: maxX, y: busY))
            ctx.stroke(bus, with: .color(color), style: style)

            // Each parent drops from its bottom to the bus, rounding the turn.
            for px in parentXs {
                var drop = Path()
                drop.move(to: CGPoint(x: px, y: parentBottom))
                drop.addLine(to: CGPoint(x: px, y: busY))
                ctx.stroke(drop, with: .color(color), style: style)
            }
            // Each child drops from the bus to its top.
            for cx in childXs {
                var drop = Path()
                drop.move(to: CGPoint(x: cx, y: busY))
                drop.addLine(to: CGPoint(x: cx, y: childTop))
                if let child = children.first(where: { $0.x + Self.nodeSize.width / 2 == cx }) {
                    drop.addLine(to: CGPoint(x: cx, y: child.y))
                }
                ctx.stroke(drop, with: .color(color), style: style)
            }
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
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary),
                at: CGPoint(x: rect.minX + 12, y: rect.minY + 16),
                anchor: .leading
            )
            ctx.draw(
                Text(person.yearsLabel)
                    .font(Theme.body(11))
                    .foregroundStyle(Theme.textMuted),
                at: CGPoint(x: rect.minX + 12, y: rect.minY + 34),
                anchor: .leading
            )
            drawBadges(for: person, in: rect, ctx: &ctx)
        }
    }

    /// The web's badge grammar on the node card: circles for trauma events,
    /// squares for life events, a star for turning points.
    private func drawBadges(for person: TreePerson, in rect: CGRect, ctx: inout GraphicsContext) {
        guard let story = data.stories[person.id], !story.isEmpty else { return }
        var x = rect.minX + 12
        let y = rect.maxY - 14
        let s: CGFloat = 9

        for item in story.trauma {
            let dot = Path(ellipseIn: CGRect(x: x, y: y, width: s, height: s))
            ctx.fill(dot, with: .color(CategoryColors.trauma(item.category)))
            x += s + 4
        }
        for item in story.life {
            let square = Path(CGRect(x: x, y: y + 0.5, width: s - 1, height: s - 1))
            ctx.fill(square, with: .color(CategoryColors.life(item.category)))
            x += s + 4
        }
        for _ in story.turning {
            var star = Path()
            let c = CGPoint(x: x + s / 2, y: y + s / 2)
            for i in 0..<10 {
                let r = i % 2 == 0 ? s / 2 : s / 4.6
                let a = -CGFloat.pi / 2 + CGFloat(i) * .pi / 5
                let p = CGPoint(x: c.x + r * cos(a), y: c.y + r * sin(a))
                i == 0 ? star.move(to: p) : star.addLine(to: p)
            }
            star.closeSubpath()
            ctx.fill(star, with: .color(CategoryColors.turningPoint))
            x += s + 4
        }
    }
}

/// A person's page: years, notes, and their story in the badge grammar's
/// order: what happened, life events, turning points. Read-only.
struct PersonSheet: View {
    let person: TreePerson
    let story: PersonStory

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(person.name)
                        .font(Theme.heading(19))
                        .foregroundStyle(Theme.textPrimary)
                        .padding(.top, 28)

                    Text(person.yearsLabel)
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.textMuted)

                    if person.isAdopted {
                        Text(t("Adopted"))
                            .font(Theme.body(13))
                            .foregroundStyle(Theme.textMuted)
                    }

                    if let notes = person.notes, !notes.isEmpty {
                        Text(notes)
                            .font(Theme.body(Theme.bodySize))
                            .foregroundStyle(Theme.textPrimary)
                            .padding(.top, 4)
                    }

                    storySection(t("What happened"), items: story.trauma) {
                        Circle().fill(CategoryColors.trauma($0.category))
                    }
                    storySection(t("Life events"), items: story.life) {
                        Rectangle().fill(CategoryColors.life($0.category))
                    }
                    storySection(t("Turning points"), items: story.turning) { _ in
                        Circle().fill(CategoryColors.turningPoint)
                    }

                    Text(t("Editing happens at the desk; the phone is for looking and writing."))
                        .font(Theme.body(12))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.top, 20)
                        .padding(.bottom, 16)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func storySection(
        _ title: String,
        items: [StoryItem],
        @ViewBuilder marker: @escaping (StoryItem) -> some View
    ) -> some View {
        if !items.isEmpty {
            Text(title)
                .font(Theme.body(13, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .padding(.top, 14)
            ForEach(items) { item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    marker(item)
                        .frame(width: 9, height: 9)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(item.title)
                                .font(Theme.body(Theme.bodySize))
                                .foregroundStyle(Theme.textPrimary)
                            if let date = item.date {
                                Text(date)
                                    .font(Theme.body(12))
                                    .foregroundStyle(Theme.textMuted)
                            }
                        }
                        if let description = item.description, !description.isEmpty {
                            Text(description)
                                .font(Theme.body(13))
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                }
            }
        }
    }
}
