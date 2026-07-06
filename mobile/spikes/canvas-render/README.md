# Spike: native tree canvas rendering (M1, spike two)

Date: 2026-07-06
Design: `docs/plans/2026-07-05-ios-companion-design.md`
Verdict: **GO, with one honest caveat about edge routing (below).**

## Question

Can a native renderer reproduce the Traumatrees tree faithfully from the
data the phone will have after decryption: person positions, sizes, badges,
and relationship structure?

## Method

1. `layout.json` was extracted from the live `/demo` React Flow canvas:
   node flow-coordinates and sizes, badge kinds/colors/initials, and every
   edge's SVG path with stroke, dash, and width.
2. `render_tree.swift` replays that geometry with CoreGraphics (the same
   drawing substrate SwiftUI `Canvas` uses on iOS): dark-theme tokens from
   `theme.css`, rounded node cards, name/years text, the badge grammar
   (circles trauma, squares life events, triangles classifications, star
   turning points, initials), sibling-group pills, and a minimal SVG path
   parser (M/L/Q/C) for the edges.
3. Compared against `web-reference.png`, a screenshot of the same canvas.

## Results

`native-render.png` reproduces the web layout structurally 1:1: the
family-connector buses with rounded corners and shared junctions, partner
edges in pink with solid (current period) and dashed (ended) states,
inferred half-sibling dashes, sibling-group pills with their dashed
connectors, and full badge rows. Positions come straight from the data, so
a real user's hand-arranged tree renders identically.

The reference screenshot happens to be light theme while the native render
uses dark tokens; the comparison is structural, which is what the spike
needed to prove.

## The caveat: edge routing is an algorithm, not data

Node positions ship inside the encrypted person payloads, but edge paths do
not exist in the data; the web computes them at render time
(family-connector buses, junction points, partner-edge anchoring, curved
step edges). This spike replayed the web's computed paths. The real app
must port that routing logic. It is deterministic geometry driven by node
positions and relationship types, well suited to the KMP core with a
fixture test comparing computed paths against a web-extracted snapshot like
`layout.json`. Plan it as its own M4 work item, roughly the size of the
badge/node rendering itself.

## Smaller findings for M4

- Partner edges carry small junction markers (dots/squares at midpoints)
  rendered as separate SVG elements; not reproduced here, trivial to add.
- Node text uses Lato on the web; this spike used the system font. Bundle
  Lato in the app (already planned for the design language).
- 13px badge shapes with 8px bold initials are legible at 1x; retina
  scaling needs no special handling since everything is vector.

## Rerunning

```
swift render_tree.swift
```

`layout.json` and `web-reference.png` were captured from `/demo` on the dev
server; re-extract them with the browser snippet in the session notes if
the demo family or PersonNode markup changes.
