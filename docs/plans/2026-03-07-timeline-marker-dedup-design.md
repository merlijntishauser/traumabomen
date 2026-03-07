# Timeline Marker Deduplication

## Problem

`PersonLane.tsx` (652 lines) and `AgePersonLane.tsx` (538 lines) contain near-identical marker rendering logic for trauma events, life events, turning points, and classification strips. The only difference is coordinate mapping: `PersonLane` maps years to x-coordinates (horizontal), while `AgePersonLane` maps ages to y-coordinates (vertical).

This duplication means every visual change (tooltip style, badge shape, click handler, color logic) must be applied twice.

## Approach: Orientation Strategy + Shared Render Functions

Introduce a `LaneOrientation` interface that abstracts coordinate mapping, then extract four shared render functions that accept the orientation and produce SVG elements.

## Design

### LaneOrientation Interface

```ts
interface LaneOrientation {
  /** Convert a domain value (year or age) to the primary axis position. */
  pos: (value: number) => number;

  /** The fixed coordinate on the cross-axis (vertical center or horizontal center). */
  center: number;

  /** Transform string for marker placement at (pos, center). */
  markerTransform: (pos: number) => string;

  /** Position a label relative to a marker. */
  labelAt: (pos: number) => { x: number; y: number; textAnchor: string };

  /** Format a domain value for display (e.g. "1985" vs "age 5"). */
  dateText: (value: number) => string;

  /** Build rect attributes for a classification strip between two domain values. */
  stripRect: (start: number, end: number, offset: number) => {
    x: number; y: number; width: number; height: number;
  };

  /** Position a label on a classification strip. */
  stripLabelAt: (start: number, end: number, offset: number) => {
    x: number; y: number; textAnchor: string;
  };
}
```

Each lane constructs a concrete orientation object from its existing scale and dimensions:

- **PersonLane** (horizontal): `pos = xScale(year)`, `center = laneHeight / 2`, markers placed at `(pos, center)`
- **AgePersonLane** (vertical): `pos = yScale(age)`, `center = laneWidth / 2`, markers placed at `(center, pos)`

### MarkerContext + Render Functions

A `MarkerContext` bundles everything the render functions need beyond orientation:

```ts
interface MarkerContext {
  orientation: LaneOrientation;
  personId: string;
  persons: Person[];
  categoryColors: Record<string, string>;
  classificationColors: { suspected: string; diagnosed: string };
  dims: { markerRadius: number; stripHeight: number };
  filterMode: string | null;
  hoveredPatternId: string | null;
  patterns: Pattern[];
  onMarkerClick: (entityType: string, entityId: string) => void;
  onMarkerHover: (entityId: string | null) => void;
  t: TFunction;
}
```

Four shared render functions, each returning `ReactNode`:

| Function | Input | Output |
|---|---|---|
| `renderTraumaMarkers` | `ctx, traumaEvents[]` | Circle markers with category color, severity-based size, tooltips |
| `renderLifeEventMarkers` | `ctx, lifeEvents[]` | Square markers (rotated 45deg) with category color, tooltips |
| `renderTurningPointMarkers` | `ctx, turningPoints[]` | Star/diamond markers with tooltips |
| `renderClassificationMarkers` | `ctx, classifications[]` | Rounded-rect strips spanning period ranges, status-colored |

### Strip Positioning

Classification strips stack vertically (horizontal lane) or horizontally (vertical lane) using an offset multiplier. The `stripRect` and `stripLabelAt` methods on `LaneOrientation` handle this:

- Horizontal: strips stack below the life bar, offset increases `y`
- Vertical: strips stack beside the life bar, offset increases `x`

### File Structure

New file: `frontend/src/components/timeline/timelineMarkers.tsx` (~250 lines)

Exports:
- `LaneOrientation` (interface)
- `MarkerContext` (interface)
- `renderTraumaMarkers`
- `renderLifeEventMarkers`
- `renderTurningPointMarkers`
- `renderClassificationMarkers`

### Testing Strategy

- Extract and test pure logic (color selection, position calculation) via unit tests
- Existing Playwright timeline tests cover visual regression
- No new visual/snapshot tests needed; the refactor is behavior-preserving

### Migration Path

1. Create `timelineMarkers.tsx` with interfaces and render functions
2. Update `PersonLane.tsx`: construct horizontal orientation, replace inline rendering with shared function calls (~300 lines removed)
3. Update `AgePersonLane.tsx`: construct vertical orientation, replace inline rendering with shared function calls (~300 lines removed)
4. Run existing tests to verify no regression

Each lane's render method goes from ~200 lines of inline SVG to ~5 function calls. Total net reduction: ~500 lines.
