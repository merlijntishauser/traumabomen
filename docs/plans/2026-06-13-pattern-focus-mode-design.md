# Pattern focus mode (canvas spotlight)

## Purpose

Replace the always-on metaball pattern blobs on the tree canvas with a single
spotlight: pick one saved pattern, the whole tree dims, and that pattern's
people stay crystal-clear and carry the pattern's colour. It reads one pattern's
reach across generations far more clearly than overlapping blobs do.

## Decisions (settled)

- **Replace, not augment.** `PatternConnectors` (the metaball blobs) comes off
  the tree canvas. Focus mode is the canvas's only pattern visualisation. The
  multi-pattern "show all groupings" view stays the timeline's / pattern page's
  job.
- **One pattern at a time**, chosen from a dropdown.
- **Dim everything else.** Non-member nodes and *all* edges fade to barely
  visible (~15-18% opacity). Edges are not exempted, even between two members.
- **Member nodes stay full clarity** and recolour their **top accent border** to
  the pattern colour (the subtle, structural treatment, not a glow or full tint).
- **Title + info.** A small banner shows the focused pattern's name in its
  colour with an info button; the button opens a modal reusing the pattern
  detail already rendered on the pattern page (description, linked events /
  classifications with the person each touches, person count, generation span).
- **Exit** by choosing "Done" in the dropdown, picking another pattern, or
  clicking empty canvas.

## How it works

### State

A single `focusedPatternId: string | null` in the workspace. Deriving from it:
`focusedPattern` (the `DecryptedPattern`), its `memberIds = new Set(person_ids)`,
and its colour via `getPatternColor(pattern.color)`. Purely transient UI state,
nothing persisted.

### Canvas dimming

CSS opacity on a parent caps the child, so members cannot be lit by un-dimming a
dimmed wrapper. Therefore:

- **Nodes are dimmed per node.** `useTreeLayout` takes the focus info and, per
  person node, sets `node.className = 'rf-node-dimmed'` for non-members (CSS:
  `opacity: 0.16; transition: opacity 0.2s`) and leaves members at full opacity.
  Member `PersonNodeData` gains `focusColor: <pattern colour>`; `PersonNode`
  applies it as an inline `border-top-color`, overriding `--color-accent`. New
  optional fields on `PersonNodeData`: `dimmed?: boolean`, `focusColor?: string`.
- **Edges dim uniformly via a wrapper class.** The React Flow container gets
  `tree-canvas--focused`; CSS fades `.react-flow__edge` to ~16%. No edge is
  exempted, matching the spec, so a wrapper class is enough (no per-edge data).

`SiblingGroupNode` follows the same node rule (dimmed unless a member).

### Trigger / dropdown

The existing `Waypoints` "Patterns" toolbar button becomes a dropdown:

- A list of saved patterns, each a colour swatch + name; selecting one sets
  `focusedPatternId`.
- The currently focused pattern is checked, with a "Done" / "Show all" row to
  clear focus.
- A "Manage patterns" row opens the existing `PatternPanel` (CRUD) unchanged.
- Empty state (no patterns) points at "Manage patterns" to create one.

### Banner + info modal

When focused, a `PatternFocusBanner` overlays the canvas (top-centre, in the
panel grammar): the pattern name in its colour, an info button, and a close
control. Info opens a modal that reuses the pattern-detail content from
`PatternView` (extract a `PatternDetail` piece both can render): description,
the resolved linked entities (entity + the person it touches), person count and
generation span.

## Scope

- **In:** the focus mode above on the tree workspace canvas; removing the blobs
  from that canvas; the dropdown; the banner + info modal.
- **Out:** the pattern CRUD panel (unchanged), the timeline's pattern lanes /
  rings (unchanged), the pattern page (unchanged), the public demo (it already
  defaults patterns off; it keeps no blobs and gains no focus control for now).
- **Not persisted:** focus is per-session UI state.

## Testing

- Unit: the member-set / colour derivation from a focused pattern; the layout
  helper tagging nodes dimmed vs member and stamping `focusColor`.
- Integration: selecting a pattern in the dropdown dims non-members and recolours
  member borders; "Done" / empty-click clears it; the banner shows the name and
  the info modal lists the linked entities; only one pattern focuses at a time.
- E2E (demo tree): focus a pattern, confirm the spotlight, open info, exit.

## Files

### New

| File | Purpose |
|------|---------|
| `frontend/src/components/tree/PatternFocusMenu.tsx` | Toolbar dropdown: saved patterns, Done, Manage |
| `frontend/src/components/tree/PatternFocusBanner.tsx` | On-canvas name banner + info trigger |
| `frontend/src/components/tree/PatternDetail.tsx` | Shared pattern detail (extracted from PatternView), used by the info modal |

### Modified

| File | Changes |
|------|---------|
| `frontend/src/hooks/useTreeLayout.ts`, `lib/treeLayoutHelpers.ts` | Accept focus info; tag nodes dimmed / member; stamp `focusColor`; `PersonNodeData` fields |
| `frontend/src/components/tree/PersonNode.tsx` / `.css` | Apply `focusColor` to the top border; `rf-node-dimmed` opacity rule |
| `frontend/src/components/tree/SiblingGroupNode.tsx` | Dim unless a member |
| `frontend/src/pages/TreeWorkspacePage.tsx` / `TreeCanvas.css` | `focusedPatternId` state; remove `PatternConnectors`; `tree-canvas--focused` edge dimming; wire dropdown + banner |
| `frontend/src/components/PatternView.tsx` | Render the extracted `PatternDetail` |
| `frontend/public/locales/{en,nl}/translation.json` | Dropdown / banner / modal strings |

`PatternConnectors.tsx` is left in the tree for now (the timeline does not use it,
but removing the file is a separate cleanup once focus mode lands).

## Open question

- The info modal vs a slide-in panel: a centred modal is simplest and matches
  "info modal" from the idea; if it feels heavy over the canvas, a right-side
  panel (the existing panel grammar) is the fallback. Decide when we see it.
