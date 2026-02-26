# Replace Dagre with elkjs and Add Collapsible Sub-Trees

**Goal:** Replace Dagre with elkjs for more powerful auto-layout, add the ability to collapse ancestor/descendant sub-trees into compact summary nodes, and drop the React Flow Pro dependency by showing the free-tier watermark.

## Motivation

React Flow Pro's auto-layout wraps elkjs internally. By using elkjs directly, we get the same layout capabilities (compound nodes, better edge routing, more algorithms) at zero cost. Combined with a collapse feature, this addresses the two pro features that were most appealing (auto-layout and collapsible nodes) without a subscription.

## Part 1: elkjs Migration

### What Changes

Replace `dagre` with `elkjs` in the layout pipeline. The integration boundary stays the same: `useTreeLayout` takes domain data in, returns `PersonNodeType[]` and `RelationshipEdgeType[]` out. Everything downstream (PersonNode, RelationshipEdge, PatternConnectors, TreeWorkspacePage) is unaffected.

### elkjs API

elkjs uses a declarative JSON graph. You pass a root node containing `children` (nodes with `width`/`height`) and `edges` (source/target references), set `layoutOptions`, and call `elk.layout()`. It returns the same structure with `x`/`y` positions computed.

```typescript
import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

const graph = {
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.spacing.nodeNode": "60",
    "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  },
  children: [
    { id: "person-1", width: 180, height: 80 },
    { id: "person-2", width: 180, height: 80 },
  ],
  edges: [
    { id: "e1", sources: ["person-1"], targets: ["person-2"] },
  ],
};

const result = await elk.layout(graph);
// result.children[i].x, result.children[i].y now contain positions
```

### Migration Strategy

**File: `treeLayoutHelpers.ts`**

Replace `layoutDagreGraph()` with `layoutElkGraph()`:

- Same inputs: `persons`, `relationships`, `friendOnlyIds`, `inferredSiblings`
- Same output shape: positioned nodes that `buildPersonNodes()` can consume
- Instead of returning a `dagre.graphlib.Graph`, return a `Map<string, { x: number; y: number }>` (node positions)
- The `DagreResult` type becomes `LayoutResult`:

```typescript
interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  partnerPairs: [string, string][];
}
```

**What stays the same:**

- `buildPersonNodes()`: Takes positions instead of a dagre graph; minor signature change
- `buildRelationshipEdges()`: Unchanged (works with node centers, not dagre)
- `adjustEdgeOverlaps()`, `assignMarkerShapes()`, `pickHandles()`: Unchanged
- `positionFriendNodes()`: Stays as post-processing (friends positioned right of family tree)
- `alignPartnerPair()` / `resolveOverlaps()`: Keep as post-processing initially; can be replaced by elk constraints later
- Junction fork logic: Unchanged

**What changes:**

- `layoutDagreGraph()` replaced by `layoutElkGraph()` (async, since `elk.layout()` returns a Promise)
- `useTreeLayout` hook: The layout call becomes async; wrap in `useEffect` + state, or use `useMemo` with a synchronous elk variant (`elk.bundled.js` supports sync mode)
- `resolveNodePosition()`: Reads from positions map instead of dagre graph
- `computeFriendY()` / `findMaxFamilyX()`: Read from positions map instead of dagre graph

**Hook change:**

`useTreeLayout` currently returns `{ nodes, edges }` synchronously via `useMemo`. With elkjs, layout is async. Two options:

1. **Use `elkjs/lib/elk.bundled.js`** (synchronous, runs on main thread): No hook changes needed, simpler, but blocks main thread for large trees.
2. **Use `elkjs` with web worker** (async): Hook returns empty layout initially, then updates when layout completes. Better for large trees but adds complexity.

Recommendation: Start with the bundled synchronous version. Trees in this app are family-sized (tens to low hundreds of nodes), not enterprise graph-sized. Move to web worker later if performance becomes an issue.

### Dependency Changes

- Add: `elkjs` (MIT, ~200KB bundled)
- Remove: `dagre`, `@types/dagre`

## Part 2: Collapsible Sub-Trees

### State Model

New state in `TreeWorkspacePage`:

```typescript
// Each entry means "this person's ancestors/descendants are collapsed"
type CollapseDirection = "ancestors" | "descendants";
type CollapseEntry = { personId: string; direction: CollapseDirection };

const [collapsed, setCollapsed] = useState<CollapseEntry[]>([]);
```

A person can have both directions collapsed simultaneously (e.g. collapse ancestors and descendants to focus on just that person and their partners/siblings).

Collapse state is ephemeral (in-memory only, resets on page reload). It is a UI preference, not sensitive data, so no encryption needed.

### Graph Traversal

New file: `collapseHelpers.ts`

```typescript
/**
 * Given a person and direction, find all person IDs that should be hidden.
 * "ancestors": BFS upward following parent-type edges (biological, step, adoptive).
 * "descendants": BFS downward following child-type edges (inverse of parent).
 * Stops at the boundary (the collapsed person itself is NOT hidden).
 */
function findHiddenPersons(
  personId: string,
  direction: CollapseDirection,
  relationships: Map<string, DecryptedRelationship>,
): Set<string>;

/**
 * Compute the full set of hidden person IDs from all collapse entries.
 * A person is hidden if ANY collapse entry hides them, UNLESS they are
 * themselves a collapse anchor (the person who was collapsed).
 */
function computeAllHidden(
  entries: CollapseEntry[],
  relationships: Map<string, DecryptedRelationship>,
): Set<string>;

/**
 * Build summary data for each collapse entry (person count, generation span).
 */
function buildCollapseSummaries(
  entries: CollapseEntry[],
  hiddenIds: Set<string>,
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, CollapseSummary>;  // keyed by "personId:direction"
```

### Summary Node

New component: `CollapsedSummaryNode.tsx`

A custom React Flow node type, smaller than PersonNode. Visual design:

- Size: ~120x50 (smaller than the 180x80 PersonNode)
- Background: `--color-bg-secondary` with `--color-border` border
- Content: Direction icon (chevron-up for ancestors, chevron-down for descendants) + count text (e.g. "4 persons, 2 gen.")
- Text: `--font-body` (Lato), `--color-text-muted`, 12px
- Single handle on the side facing the remaining tree (bottom handle for ancestor summaries, top handle for descendant summaries)
- Click to expand (restores the hidden sub-tree)
- Hover: `--color-bg-hover` background transition (`0.15s ease`)

The summary node is positioned where the collapsed sub-tree's root would have been. elkjs handles this naturally since we simply remove the hidden nodes and add the summary node in their place before running layout.

### PersonNode Toggle Controls

Add small collapse/expand icons to `PersonNode.tsx`:

- Top edge: small chevron-up icon (collapse ancestors). Only visible when the person has ancestors.
- Bottom edge: small chevron-down icon (collapse descendants). Only visible when the person has descendants.
- Icons appear on hover with `opacity: 0 -> 1` transition (`0.15s ease`).
- Icons use `--color-text-muted`, 12px, positioned just outside the node boundary.
- When a direction is already collapsed, the icon changes to an expand indicator.

### Layout Integration

The collapse feature integrates between data loading and layout:

1. `useTreeLayout` receives the full person/relationship maps (unchanged)
2. Before layout, apply collapse: filter out hidden persons, remove their relationships, insert summary node placeholders
3. Run elkjs layout on the filtered set
4. Build React Flow nodes/edges from the result

This filtering step is a new function in the layout pipeline:

```typescript
function applyCollapse(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  collapsed: CollapseEntry[],
): {
  filteredPersons: Map<string, DecryptedPerson>;
  filteredRelationships: Map<string, DecryptedRelationship>;
  summaryNodes: SummaryNodeData[];
}
```

The `useTreeLayout` hook signature gains one new parameter:

```typescript
function useTreeLayout(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  selectedPersonId: string | null,
  lifeEvents?: Map<string, DecryptedLifeEvent>,
  canvasSettings?: Pick<CanvasSettings, "edgeStyle" | "showMarkers">,
  classifications?: Map<string, DecryptedClassification>,
  turningPoints?: Map<string, DecryptedTurningPoint>,
  collapsed?: CollapseEntry[],  // NEW
): { nodes: PersonNodeType[]; edges: RelationshipEdgeType[] }
```

## Part 3: Watermark and Cleanup

Remove `proOptions={{ hideAttribution: true }}` from `TreeWorkspacePage.tsx`. The React Flow free tier watermark is small and unobtrusive.

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `elkjs`, remove `dagre` + `@types/dagre` |
| `treeLayoutHelpers.ts` | Replace `layoutDagreGraph` with `layoutElkGraph`, update position reading |
| `useTreeLayout.ts` | Pass collapse entries, call `applyCollapse` before layout |
| `TreeWorkspacePage.tsx` | Add `collapsed` state, toggle handlers, remove `proOptions` |
| `PersonNode.tsx` | Add hover-reveal collapse/expand icons |
| New: `CollapsedSummaryNode.tsx` | Custom React Flow node for collapsed sub-trees |
| New: `collapseHelpers.ts` | Graph traversal and summary computation |
| New: `collapseHelpers.test.ts` | Tests for traversal logic |
| New: `CollapsedSummaryNode.test.tsx` | Tests for summary node rendering |
| `treeLayoutHelpers.test.ts` | Update layout tests for elkjs |
| `useTreeLayout.test.ts` | Add collapse integration tests |

## Edge Cases

- **Overlapping collapses**: If person A collapses descendants and person B (a descendant of A) also has a collapse entry, B's entry is effectively inactive while hidden. When A expands, B's collapse re-activates.
- **Selected person hidden**: If the currently selected person (detail panel open) gets collapsed by another node, close the detail panel.
- **Partner of collapsed person**: Partners of a collapse anchor stay visible (they are not ancestors or descendants, they are lateral relationships).
- **Friend-only nodes**: Friends are not reachable via parent/child traversal, so they are never collapsed. This is correct behavior.
- **Single-person tree**: No collapse icons shown (no ancestors or descendants).

## Implementation Order

1. elkjs migration (treeLayoutHelpers + useTreeLayout + tests)
2. Collapse helpers (collapseHelpers + tests)
3. CollapsedSummaryNode component + tests
4. PersonNode toggle icons
5. TreeWorkspacePage integration (state, handlers, layout wiring)
6. Remove proOptions watermark suppression
