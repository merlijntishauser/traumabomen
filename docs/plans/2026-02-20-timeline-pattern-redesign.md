# Timeline Pattern Visualization Redesign

## Problem

The current timeline pattern visualization (`TimelinePatternArcs`) draws dashed rectangles spanning from the earliest to latest linked entity year. This implies a temporal range ("this pattern existed from 1965 to 2003") which is misleading. Patterns are thematic annotations (e.g., "addiction cycle", "displacement trauma") linking entities across persons and generations. They have no inherent time dimension.

In the canvas view, patterns work well because organic blobs highlight spatial proximity of involved persons without implying time. The timeline needs an equivalent that shows involvement without false temporal semantics.

## Design

Replace time-span rectangles with two non-temporal visual layers:

### 1. Lane tints

When a pattern is visible, each involved person's lane/column gets a subtle color wash in the pattern's color.

- **Years view**: full-height rectangle behind the person's row
- **Age view**: full-height rectangle behind the person's column
- **Opacity**: 0.08 normal, 0.14 on pattern hover
- **Z-order**: behind life bars and markers (background layer)
- **Multiple patterns**: tints stack naturally; low opacity and distinct colors blend without special handling

### 2. Marker rings

Each linked entity marker gets a colored ring in the pattern's color.

- **Trauma events (circles)**: concentric circle, 2px gap, 1.5px stroke
- **Life events (squares)**: rounded-rect outline, same gap and stroke
- **Classifications (triangles)**: circle ring at diagnosis triangle; for period strips, thin colored left border
- **Opacity**: 0.6 normal, 0.9 on pattern hover
- **Multiple patterns on one marker**: rings stack outward (2px increments), capped at 2 visible rings
- **Interaction**: hover shows pattern name in tooltip, click triggers `onPatternClick`

### 3. Lane labels

Each person's lane shows the names of all visible patterns that include them, rendered as inline text near the bottom of the row (years view) or rotated along the column edge (age view). When multiple patterns share a person, names are joined with a middle dot separator, each in its own pattern color.

### 4. Removed

- `TimelinePatternArcs` component and its tests: deleted entirely

## Interaction

- Visibility toggle (eye icon in pattern panel): unchanged
- Panel hover temporarily shows pattern: unchanged, triggers elevated opacity on tints and rings
- Pattern click navigates to pattern view page: unchanged

## Implementation

### New files

| File | Purpose |
|------|---------|
| `TimelinePatternLanes.tsx` | Renders lane/column tint rects for visible patterns |
| `TimelinePatternLanes.test.tsx` | Tests for lane tinting |

### Modified files

| File | Change |
|------|--------|
| `PersonLane.tsx` | Accept `patternRings` data, render rings around linked markers |
| `AgePersonLane.tsx` | Same: accept `patternRings` data, render rings |
| `TimelineYearsContent.tsx` | Replace `TimelinePatternArcs` with `TimelinePatternLanes`, compute and pass ring data to lanes |
| `TimelineAgeContent.tsx` | Same replacement |
| `TimelineView.css` | Remove arc styles, add tint and ring styles |

### Removed files

| File | Reason |
|------|--------|
| `TimelinePatternArcs.tsx` | Replaced by lane tints + marker rings |
| `TimelinePatternArcs.test.tsx` | Tests for removed component |
