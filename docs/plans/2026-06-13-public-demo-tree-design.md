# Public, read-only demo tree

## Purpose

The landing already offers "see an example" as the static `/tour` page (screenshots
and copy, the option-A shipped in the conversion plan). The stronger version, and
the single best remaining conversion lever, is a **public, no-account tree a
prospective visitor can actually pan, zoom, and click into**, the way a real user
would. This document designs that feature.

It is a genuine feature, not a quick task. It gets its own data source, a
read-only rendering path, routing and guards, and entry points, all on the
frontend.

## The key architectural decision: client-only, no backend

The app is zero-knowledge. Every tree the server holds is opaque ciphertext, and
the workspace only ever renders data that the client decrypted into memory after
the user entered a passphrase (`useTreeData` is gated on `hasKey`: a master key
plus a per-tree key).

The demo data, by contrast, is **already plaintext JSON in the frontend bundle**:
`frontend/src/fixtures/demo-tree-{en,nl}.json`, the same fixtures the in-account
"Create demo tree" uses. So the public demo needs **no backend at all**:

- No unauthenticated read endpoint (nothing for the server to expose or rate-limit).
- No plaintext demo data on the server (it stays a static client asset).
- No new attack surface, and no contradiction of the "thin encrypted store" design.

The "unauthenticated read path" is therefore a **client-side data source**, not a
server route. This removes essentially all of the security design the feature
first appears to need. The remaining work is entirely frontend.

### Rejected alternative

A public `GET /demo/tree` returning plaintext fixtures. Adds an unauthenticated
surface and server-held plaintext for zero benefit over reading the bundled
fixture. Rejected.

## Data source: fixture to in-memory state

`useTreeData(treeId)` returns one `Map<string, DecryptedX>` per entity type
(persons, relationships, events, life events, classifications, turning points,
sibling groups, patterns), produced by fetch-then-decrypt. The demo produces the
**same maps** without fetching or decrypting:

```
buildDemoState(fixture: DemoFixture): {
  treeName, persons, relationships, events, lifeEvents,
  classifications, turningPoints, siblingGroups, patterns  // all Map<string, DecryptedX>
}
```

This mirrors the transform `createDemoTree` already performs before it encrypts,
minus the encryption and UUID remapping (the fixture's stable string ids such as
`demo-p1` are fine as React keys; nothing persists). `DemoFixture` and the fixture
JSON are reused as-is. A `useDemoTreeData(language)` hook loads the right-language
fixture (lazy `import()`, same as `createDemoTree.loadFixture`) and memoizes
`buildDemoState`.

## Component reuse and the read-only renderer

Verified (the load-bearing premise): `useTreeLayout`, `PersonNode`,
`RelationshipEdge`, `SiblingGroupNode`, `PatternConnectors`, and `TimelineView`
import only *types* from `useTreeData` (`import type { DecryptedX }`, erased at
compile time). None reach into auth, encryption, query, or mutation runtime. So a
fixture-fed, read-only render genuinely works with no master key.

The hard parts of the workspace are data-source-agnostic and reusable directly:

- `useTreeLayout(persons, relationships, events, selected, lifeEvents, settings, classifications, turningPoints, siblingGroups)` is a pure `useMemo` over the maps to React Flow nodes/edges.
- The node/edge components (`PersonNode`, `SiblingGroupNode`, `RelationshipEdge`) render from layout output.
- `PatternConnectors` overlays cross-generational pattern links from the same maps.
- `filterByPerson` (exported from `useTreeData`) is a presentational helper for the read-only card.
- `TimelineView` renders from the same maps (fast-follow, not v1).

What is **not** reused: `useTreeData` (auth/decrypt gated), `useTreeMutations`
(the entire write surface: create/update/delete/sync), `useWorkspacePanels`,
drag-to-persist, add-person, and the editing toolbar.

**Decision for the first cut: a dedicated `DemoTreePage` rather than threading a
`readOnly`/`demoSource` flag through `TreeWorkspacePage`.** `TreeWorkspacePage` is
large and deeply write-coupled; teaching it a second data source and a read-only
mode risks the production workspace for no first-cut benefit. The demo page
composes the shared, data-agnostic pieces (layout hook, node/edge components,
read-only detail panel, `TimelineView`) and assembles a minimal read-only React
Flow canvas itself. A later refactor can extract a shared presentational
`<TreeCanvasView>` that both pages use; that is explicitly out of scope here, and
noted so we do not pretend the duplication is invisible.

## Read-only enforcement

The demo canvas allows pan, zoom, fit-view, minimap, and node selection. It
disables everything that writes or implies persistence:

- No `onConnect`, no drag-to-create, no add-person, no context menus that mutate.
- **Node dragging is locked** (`nodesDraggable={false}`): one prop, and it reads as
  read-only. (Simpler than "draggable but non-persisted", which needs handlers.)
- Clicking a node opens a **lightweight read-only person card** (a new
  `DemoPersonCard`), not the live editor. It shows the person's fields and, via the
  exported `filterByPerson`, their trauma events, life events, and classifications,
  as static display. We do **not** retrofit `PersonDetailPanel` (371 lines, ~17
  input/mutation sites): too invasive, and it would put the live editor at risk for
  a demo.
- No settings panel, no export/import, no journal editing.
- The page never mounts `useTreeMutations` and never calls the write API, so a
  mutation cannot fire even by mistake.

## Routing and guards

- New public route, lazy-loaded: `/demo` (canvas) for v1. `/demo/timeline` arrives
  with the timeline fast-follow; a demo `ViewTabs` variant (`DemoTabs`) is built
  then. In v1 the demo chrome is a minimal header: tree name, a back-to-site
  control, and the persistent "create your own" CTA.
- Registered in `App.tsx` as a public route (no `AuthGuard`), and it must render
  with **no master key**: the demo path must not depend on `EncryptionProvider`
  state. `useDemoTreeData` supplies data directly, so the page works for a logged-
  out visitor.
- **`isPublicRoute` in `App.tsx` must include `/demo`** (and later `/demo/timeline`).
  Otherwise `AppContent` treats it as an authenticated route and the unlock/reauth
  `AuthModal` fires over the demo. This is the one concrete wiring the "no
  EncryptionProvider dependency" goal hinges on.
- **Lazy is mandatory.** The demo pulls `vendor-reactflow` (and the canvas pulls in
  the layout/dagre code). It must be a `lazyWithReload` route so it does not regress
  the public landing budget that the recent perf work protected (those chunks stay
  out of the entry; they load only when `/demo` is opened).

## Entry points, CTAs, and `/tour`

- Landing: a primary "Explore a live demo" CTA (alongside or replacing the current
  `/tour` link).
- Inside the demo: a persistent, gentle "This is a fictional family. Create your
  own private tree" CTA to `/register`, in the existing button grammar, plus a
  short read-only banner so visitors understand nothing they touch is saved.
- `/tour` (static) stays for now; once the live demo proves itself we decide whether
  it folds into `/demo`. The sitemap and per-route title/meta gain `/demo` (it is
  the more linkable, more indexable artifact).

## i18n

Fixture content already has EN/NL. New demo-shell UI strings (banner, CTAs, tab
labels, read-only labels) added to both locale files in lockstep. Voice rules
apply: "you/your", no exclamation marks, no em-dashes.

## Scope

- **First cut (v1): canvas only.** `/demo` pannable/zoomable canvas with pattern
  connectors, the read-only `DemoPersonCard` on node click, a read-only banner, the
  "create your own" CTA, a lazy route, and EN/NL. This is the whole "pan and click"
  conversion wow on its own.
- **First fast-follow:** the read-only timeline (`/demo/timeline` + `DemoTabs`).
- **Later:** read-only patterns and insights views.
- **Out of scope:** any backend change; editing of any kind; a shared
  `<TreeCanvasView>` refactor of the real workspace.

## Testing

- Unit: `buildDemoState` (fixture to maps, counts, linked-entity person_ids,
  pattern links resolve), `useDemoTreeData` language selection.
- Integration: `DemoTreePage` renders nodes from the fixture, opens a read-only
  panel on node click with no inputs, exposes no add/save/delete affordance, shows
  the CTA, and never calls the write API.
- E2E: visit `/demo` logged out, pan/zoom, click a person, switch to the timeline
  tab, confirm no auth prompt and no network writes.

## Files

### New (v1)

| File | Purpose |
|------|---------|
| `frontend/src/lib/buildDemoState.ts` | Fixture to in-memory decrypted maps (+ `.unit.test.ts`) |
| `frontend/src/hooks/useDemoTreeData.ts` | Load language fixture, memoize `buildDemoState` |
| `frontend/src/pages/DemoTreePage.tsx` | Read-only canvas page, lazy; minimal demo header + banner + CTA |
| `frontend/src/components/tree/DemoPersonCard.tsx` | Lightweight read-only person card (uses `filterByPerson`) |

### Modified (v1)

| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | Public lazy `/demo` route **and add `/demo` to `isPublicRoute`** |
| `frontend/src/pages/LandingPage.tsx` | "Explore a live demo" CTA beside the `/tour` link |
| `frontend/public/locales/{en,nl}/translation.json` | Demo-shell strings (banner, CTA, card labels) |
| `frontend/public/sitemap.xml`, route meta | Add `/demo` |

### Fast-follow (timeline)

| File | Purpose |
|------|---------|
| `frontend/src/pages/DemoTimelinePage.tsx` | Read-only timeline page (lazy) |
| `frontend/src/components/tree/DemoTabs.tsx` | Demo `ViewTabs` variant linking `/demo` and `/demo/timeline` |

## Resolved decisions

- **Read-only surface:** a lightweight `DemoPersonCard`, not a `readOnly` retrofit of `PersonDetailPanel`.
- **Node dragging:** locked (`nodesDraggable={false}`).
- **Pattern connectors:** shown on the v1 canvas.
- **v1 scope:** canvas only; timeline is the first fast-follow.
- **`/tour`:** the live `/demo` link sits beside the `/tour` link for now.

## Open question

1. Once the live `/demo` proves itself, does it fold in / replace `/tour`, or do
   both stay? Deferred until we can compare them.
