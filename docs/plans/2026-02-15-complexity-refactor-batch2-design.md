# Design: Reduce cognitive complexity -- batch 2

## Problem

Six functions exceed the sonarjs/cognitive-complexity threshold of 15:

| File | Function | Line | Complexity |
|------|----------|------|-----------|
| `src/lib/inferSiblings.ts` | `inferSiblings` | 11 | 21 |
| `src/components/tree/RelationshipEdge.tsx` | `buildForkPath` | 43 | 27 |
| `src/components/tree/RelationshipEdge.tsx` | `RelationshipEdgeComponent` | 113 | 32 |
| `src/components/timeline/TimelineView.tsx` | `computeGenerations` | 54 | 24 |
| `src/components/timeline/TimelineView.tsx` | `render` callback | 145 | 29 |
| `src/components/timeline/TimelineView.tsx` | `renderTimeContent` | 318 | 53 |

## Approach

Same pattern as the `useTreeLayout` refactor: extract pure/isolated helper functions into dedicated helper files, keeping the original modules as thin orchestrators. Each helper stays under complexity 15.

## File plan

| File | Action | Description |
|------|--------|-------------|
| `src/lib/inferSiblings.ts` | **Edit** | Extract 2 helpers inline, flatten main function |
| `src/lib/inferSiblings.test.ts` | **Edit** | Add tests for new helpers |
| `src/components/tree/relationshipEdgeHelpers.ts` | **Create** | Pure helpers for path building, style computation, tooltip content |
| `src/components/tree/relationshipEdgeHelpers.test.ts` | **Create** | Unit tests for all helpers |
| `src/components/tree/RelationshipEdge.tsx` | **Edit** | Import helpers, slim down component |
| `src/components/timeline/timelineHelpers.ts` | **Create** | Pure helpers for generation computation, person filtering, row layout, time domain, D3 rendering sections |
| `src/components/timeline/timelineHelpers.test.ts` | **Create** | Unit tests for pure helpers |
| `src/components/timeline/TimelineView.tsx` | **Edit** | Import helpers, slim orchestrator |

---

## 1. `inferSiblings.ts` (21 -> ~8)

Extract two helpers, keep them in the same file since they're small and tightly coupled.

### New helpers

```typescript
function buildParentMap(
  relationships: Map<string, DecryptedRelationship>,
): Map<string, Set<string>>
```
Iterates relationships, returns `childId -> Set<parentId>` for biological parents. (~4 complexity)

```typescript
function buildExplicitSiblingKeys(
  relationships: Map<string, DecryptedRelationship>,
): Set<string>
```
Iterates relationships, returns set of `"idA:idB"` keys for existing sibling edges. (~4 complexity)

### Simplified `inferSiblings`

The main function becomes:
1. `const parentMap = buildParentMap(relationships)`
2. `const explicitSiblings = buildExplicitSiblingKeys(relationships)`
3. Double loop over `parentMap.entries()` to find shared parents and emit results (~8 complexity)

---

## 2. `RelationshipEdge.tsx`

### `buildForkPath` (27 -> two functions, each <15)

Create `src/components/tree/relationshipEdgeHelpers.ts`:

```typescript
function buildCurvedForkPath(fp: ForkPositions): string
```
Handles the curved edge style: parent curves, bar extension, child segments. (~14 complexity)

```typescript
function buildStraightForkPath(fp: ForkPositions): string
```
Handles the straight/elbows style: simple M/L segments. (~3 complexity)

```typescript
function buildForkPath(fp: ForkPositions, edgeStyle?: EdgeStyle): string
```
Dispatches to curved or straight. (~1 complexity)

### `RelationshipEdgeComponent` (32 -> ~12)

Extract three pure helpers:

```typescript
interface EdgeStyleResult {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}
function computeEdgeStroke(
  relType: RelationshipType | undefined,
  inferredType: string | undefined,
  flags: { isPartner: boolean; isExPartner: boolean; isFriend: boolean; isDashed: boolean; isHalfSibling: boolean },
  coupleColor?: string,
): EdgeStyleResult
```
The cascading if/else for stroke color, width, dash array. (~8 complexity)

```typescript
interface EdgePathResult {
  edgePath: string;
  hitPath: string;
  labelX: number;
  labelY: number;
}
function computeEdgePath(params: {
  isForkPrimary: boolean;
  isForkHidden: boolean;
  forkPositions: ForkPositions | null;
  sx: number; sy: number; tx: number; ty: number;
  sourcePosition: Position; targetPosition: Position;
  edgeStyle?: EdgeStyle;
}): EdgePathResult
```
The if/else for fork primary, fork hidden, and normal path computation. (~6 complexity)

```typescript
interface TooltipResult {
  typeLabel?: string;
  periodLine?: string;
}
function computeTooltipContent(
  rel: DecryptedRelationship | undefined,
  relType: RelationshipType | undefined,
  inferredType: string | undefined,
  flags: { isPartner: boolean; isExPartner: boolean },
  t: TFunction,
): TooltipResult
```
The tooltip label and period line computation. (~5 complexity)

The component itself drops to ~12: variable setup, calling the three helpers, and JSX rendering.

### Moved types/constants

Move to `relationshipEdgeHelpers.ts`:
- `ForkPositions` interface
- `MARKER_CLIP` record
- `BAR_Y_OFFSET` constant

---

## 3. `TimelineView.tsx`

### `computeGenerations` (24 -> three functions, each <15)

```typescript
function buildChildToParentsMap(
  relationships: Map<string, DecryptedRelationship>,
): Map<string, string[]>
```
Builds `childId -> parentIds[]` from parent-type relationships. (~4 complexity)

```typescript
function assignBaseGenerations(
  persons: Map<string, DecryptedPerson>,
  childToParents: Map<string, string[]>,
): Map<string, number>
```
Recursive generation assignment (contains the inner `getGeneration` function). (~10 complexity)

```typescript
function equalizePartnerGenerations(
  generations: Map<string, number>,
  relationships: Map<string, DecryptedRelationship>,
  childToParents: Map<string, string[]>,
): void // mutates generations map
```
The fixed-point while loop that equalizes partners and propagates to children. (~8 complexity)

Top-level `computeGenerations` becomes a 3-line orchestrator (~1).

### `render` callback (29 -> ~10)

Extract helpers into `timelineHelpers.ts`:

```typescript
function filterTimelinePersons(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, DecryptedPerson>
```
Filters out friend-only persons. (~6 complexity)

```typescript
interface RowLayout {
  rows: PersonRow[];
  sortedGens: number[];
  personsByGen: Map<number, DecryptedPerson[]>;
  totalHeight: number;
}
function buildRowLayout(
  timelinePersons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  availableHeight: number,
): RowLayout
```
Computes generations, groups by gen, sorts, assigns Y positions. (~5 complexity)

```typescript
function computeTimeDomain(
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
): { minYear: number; maxYear: number }
```
Scans all entities for year range. (~6 complexity)

The `render` callback becomes: filter persons, build layout, compute domain, set up SVG, call rendering sub-functions. (~10 complexity)

### `renderTimeContent` (53 -> six functions, each <15)

Each rendering section becomes a standalone function. All take a shared context parameter:

```typescript
interface TimelineRenderContext {
  timeGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  scale: d3.ScaleLinear<number, number>;
  rows: PersonRow[];
  tooltip: HTMLDivElement;
  cssVar: (name: string) => string;
  tRef: React.RefObject<TFunction>;
  currentYear: number;
}
```

| # | Function | From section | Complexity |
|---|----------|-------------|-----------|
| 1 | `renderLifeBars(ctx)` | Lines 322-338 | ~3 |
| 2 | `renderPartnerLines(ctx, relationships, persons)` | Lines 340-397 | ~8 |
| 3 | `renderTraumaMarkers(ctx, events, persons)` | Lines 399-442 | ~5 |
| 4 | `renderLifeEventMarkers(ctx, lifeEvents, persons)` | Lines 444-493 | ~7 |
| 5 | `renderClassificationStrips(ctx, classifications)` | Lines 495-593 | ~12 |
| 6 | (inline in #5) diagnosis triangle rendering | Lines 557-589 | included above |

The `renderTimeContent` function becomes a 6-line orchestrator calling each sub-function. (~1)

Note: `renderClassificationStrips` at ~12 is the densest because it handles both period strips and diagnosis triangles. If it exceeds 15 after implementation, the diagnosis triangle rendering can be extracted as `renderDiagnosisTriangle(ctx, cls, row, clsColor)`.

---

## Testing plan

### `inferSiblings.test.ts` (add ~4 tests)
- `buildParentMap`: empty, single parent, multiple parents
- `buildExplicitSiblingKeys`: empty, sibling edge creates key

### `relationshipEdgeHelpers.test.ts` (new, ~14 tests)
| Helper | Tests | Key assertions |
|--------|-------|---------------|
| `buildCurvedForkPath` | 3 | Returns string, includes Q curves, handles bar extension |
| `buildStraightForkPath` | 2 | Returns string, M/L only |
| `computeEdgeStroke` | 4 | Partner thick, ex-partner dashed, friend dotted, couple color override |
| `computeEdgePath` | 3 | Fork primary, fork hidden, normal bezier/straight/elbows |
| `computeTooltipContent` | 2 | Type label from relType, period line for partners |

### `timelineHelpers.test.ts` (new, ~16 tests)
| Helper | Tests | Key assertions |
|--------|-------|---------------|
| `filterTimelinePersons` | 3 | Excludes friend-only, includes unconnected, includes family |
| `buildRowLayout` | 3 | Sorted gens, correct Y positions, height calculation |
| `computeTimeDomain` | 3 | Birth/death range, events extend range, 5-year padding |
| `buildChildToParentsMap` | 2 | Empty, bio parent mapped |
| `assignBaseGenerations` | 3 | Root=0, child=parent+1, cycle guard |
| `equalizePartnerGenerations` | 2 | Partners equalized, children propagated |

## Verification

```bash
# TypeScript compiles
docker compose exec frontend npx tsc --noEmit

# All tests pass
docker compose exec frontend npx vitest run

# Complexity under threshold
docker compose exec frontend npx eslint \
  src/lib/inferSiblings.ts \
  src/components/tree/RelationshipEdge.tsx \
  src/components/timeline/TimelineView.tsx \
  --rule '{"sonarjs/cognitive-complexity": ["error", 15]}'

# Full complexity report clean
bash scripts/complexity-report.sh typescript
```
