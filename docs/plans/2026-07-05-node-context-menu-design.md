# Node context menu design

Date: 2026-07-05
Status: validated with user, ready to implement

## Purpose

A right-click menu on person nodes: a speed layer that collapses multi-click
creation flows into one gesture. Adding a trauma event today is ~4 clicks
(click node -> Events tab -> Trauma segment -> New); this makes it one.

Frontend-only composition over endpoints that already exist. Desktop-only (the
workspace is already desktop-gated). No backend change.

## Menu contents

A flat vertical list anchored at the cursor, three groups separated by
hairlines:

```
Add trauma event        (circle badge)
Add life event          (square badge)
Add turning point       (star badge)
Add classification      (triangle badge)
────────────────────────
Add sibling
Add partner
Add parent
Add child
────────────────────────
Open details
Delete person           (danger; two-step confirm in place)
```

## 1. Interaction & trigger

- React Flow `onNodeContextMenu(event, node)`, wired in `CanvasContent`
  alongside `onNodeClick`. `event.preventDefault()`, capture `clientX/clientY`,
  open one `NodeContextMenu` at the cursor.
- Fixed-position overlay in a portal, above nodes, below modals. Edge-aware:
  flips up/left when it would overflow the viewport.
- Dismiss on outside-click, Escape, canvas scroll/zoom/pan, or selecting an
  action. One menu at a time; right-clicking another node moves it.
- Person nodes only. Sibling-group pill and empty canvas fall through to
  default (future extension: "Add person here").
- Motion: fade/slide via `var(--transition-colors)` (0.15s ease), opacity +
  a few px, no scale, no spring.

## 2. Actions

Styled like the footer menu (`--color-bg-secondary`, 1px border,
`--shadow-lg`, `--radius-md`, ~36px rows, hover `--color-bg-hover`). Event rows
carry their existing shape badge. Delete uses the danger color.

**Attach group** reuses the panel's `initialSection` deep-link: select the
person and set the initial section to the new-entity form
(`trauma_event` / `life_event` / `turning_point` / `classification`).

**This person group:** Open details = `setSelectedPersonId`. Delete = the
tree-list two-step confirm inlined as a menu row (no separate dialog).

**Add-relation group:** section 3.

## 3. Add related person

`handleAddRelatedPerson(sourceId, kind)` composes existing pieces: create a
"New person" near the source, create the edge(s), select the new person, open
its panel (name field auto-focuses).

Relative to source S and new person N:

- **Add child** — biological-parent edge S->N; N below S.
- **Add parent** — biological-parent edge N->S; N above S.
- **Add partner** — partner edge S-N with a default period
  `{ status: together, start_year: <current year> }`; N beside S.
- **Add sibling** — collect S's biological parents
  (`collectBiologicalParentIds`) and attach N to the same parents (true
  full/half sibling, as today). No parents: fall back to a plain
  biological-sibling edge S-N. N beside S.

`findFreePosition` avoids overlap; auto-layout re-tidies later. Sibling's
multi-parent case uses `bulkCreateRelationships`.

Failure: person-mutation failure attempts no edge; edge failure leaves the
person (whisper surfaces the error) to retry from the panel. No half-broken
silent state.

## 4. Architecture & state

- Add `nodeMenu: { nodeId, x, y } | null` to `canvasInteractionReducer`, with
  `OPEN_NODE_MENU` / `CLOSE_NODE_MENU`; `DISMISS_ALL` clears it too.
- `NodeContextMenu` is presentational, rendered in `TreeWorkspacePage` next to
  the other overlays; receives the person and callbacks the workspace already
  owns (`setSelectedPersonId`, `setInitialSection`, `handleAddRelatedPerson`,
  `handleDeletePerson`).
- One pure helper for testability: `buildRelatedPersonPlan(kind, sourceId,
  sharedParentIds)` -> relationships to create + position offset. The glue is
  thin around it plus create-person and `bulkCreateRelationships`.
- Reuses `collectBiologicalParentIds`, `findFreePosition`, existing mutation
  handlers, the `initialSection` deep-link, and the `ConfirmDeleteButton`
  two-step pattern.

## 5. Testing

- **Unit** (`buildRelatedPersonPlan`): each kind's edges + offset; sibling with
  two parents -> two parent edges (full), one -> one (half), none -> fallback
  bio-sibling edge; offsets don't overlap the source.
- **Integration** (`NodeContextMenu`): three groups render with dividers and
  badges; attach actions fire `setSelectedPersonId` + correct `initialSection`
  and close; relation actions call `handleAddRelatedPerson` with the right
  kind; delete two-step confirm; Escape / outside-click / action dismiss;
  edge-aware flip.
- **E2E** (`data-entry.spec.ts`): right-click -> "Add trauma event" lands in
  the new-event form; right-click -> "Add sibling" creates a pre-linked node
  that inherits the parent, opens to the name field, persists.
- Gates: vitest, tsc, biome, complexity/quality, react-doctor 100, EN/NL
  parity for the new labels.

## Out of scope (deferred)

- Context menu on the sibling-group pill and empty canvas.
- Touch / long-press (workspace is desktop-only).
- Adding both parents at once on "Add child".
