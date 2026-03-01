# Personal Insights Summary Design

## Problem

The app is strong on mapping and visualization but thin on sense-making. Users enter trauma events, life events, classifications, turning points, and patterns, but the app offers no help surfacing what that data reveals. The insights page turns entered data into a reflection starting point.

## Solution

A read-only overview page per tree at `/trees/:id/insights` that surfaces basic observations from what the user already entered. Not AI analysis; counting, grouping, and correlation presented as insight cards. All computation happens client-side (data is encrypted).

## Insight computation engine

### Interface

```typescript
interface Insight {
  category: "generational" | "temporal" | "summary" | "resilience";
  icon: string;
  message: string;        // i18n key with interpolation values
  detail: string | null;  // optional secondary line
  priority: number;       // higher = more notable
}
```

### Input

All decrypted data from `useTreeData(treeId)` (persons, relationships, events, life events, turning points, classifications, patterns) plus generation assignments from the existing `computeGenerations()` function.

### Processing

A single pure function `computeInsights()` runs four analysis passes, each appending qualifying insights to the result array:

1. **Generational**: group trauma categories and classifications by generation number, flag any appearing in 2+ generations
2. **Temporal**: parse `approximate_date` fields, compute age-at-event using birth years, detect clustering via standard deviation
3. **Summary**: count totals by category, find shared classifications across persons
4. **Resilience**: correlate turning points with preceding trauma events within a year window, count turning point categories by generation

Trivial observations are filtered out using minimum thresholds. Results are sorted by priority.

## Specific insights

### Generational patterns (require 2+ generations)

- "[Category] appears across [N] generations": when a trauma category affects persons in 2+ distinct generations. One card per qualifying category.
- "[Classification] diagnosed across [N] generations": same logic for DSM classifications.
- "Loss events affect every generation": special case when a category spans all generations.

### Temporal clustering (require 3+ events with parseable dates)

- "[Category] events cluster around ages [range]": when standard deviation of age-at-event within a category is under 10 years, report mean +/- 1 SD.
- "Most trauma events occurred between [year]-[year]": when 60%+ of trauma events fall within a 20-year window.
- "Average age at first diagnosis: [age]": when 2+ persons have classifications with diagnosis years and birth years.

### Category summaries (shown if data exists)

- "Most common trauma category: [category] ([N] events)": dominant category when 3+ total events exist.
- "[N] persons share the same classification ([name])": when a DSM category appears on 2+ persons.
- "[N] trauma events across [N] persons": overall count when 5+ events exist.

### Resilience indicators (require 1+ turning point)

- "[N] turning points follow trauma events within [window] years": turning point date falls within 5 years after a trauma event on the same person.
- "Cycle-breaking events in [N] generations": `cycle_breaking` turning points in 2+ generations.
- "Most common turning point type: [category]": dominant category when 3+ turning points exist.

## Page layout

### Route and navigation

`/trees/:id/insights`, lazy-loaded. Toolbar button with lightbulb icon alongside canvas, timeline, patterns, and journal.

### Structure

- Page title in Playwrite NZ Basic heading font: "Insights"
- Subtitle in Lato: "Observations from what you have entered. A starting point for reflection, not conclusions."
- Four sections with headers: "Generational patterns", "Temporal clustering", "Category summaries", "Resilience indicators"
- Responsive card grid: 2 columns on desktop, 1 on mobile
- Sections with no qualifying insights hidden entirely
- Empty state when tree has too little data: "Add more persons and events to your tree to see insights here."

### Card design

- Subtle background (`--color-bg-secondary`), border (`--color-border`), rounded corners
- Small category icon top-left
- Main text: observation sentence (Lato, `--color-text-primary`)
- Detail line: supporting count (Lato, `--color-text-muted`, smaller font)
- No interactive elements. Purely read-only reflection cards.
- Cards fade in with staggered `animation-delay` on page load, 0.15s ease

## Implementation

### New files

- `frontend/src/lib/computeInsights.ts`: pure function, no React dependencies. Takes decrypted data + generations map, returns `Insight[]`. Fully unit-testable.
- `frontend/src/pages/InsightsPage.tsx`: lazy-loaded page. Calls `useTreeData()`, `computeGenerations()`, `computeInsights()`, renders card grid.
- `frontend/src/components/insights/InsightCard.tsx`: single card component.

### Changes to existing files

- `App.tsx`: add `<Route>` for `/trees/:id/insights`
- Tree toolbar: add insights navigation button
- i18n translation files: insight message keys and section headers

### Data flow

1. `InsightsPage` loads tree data via `useTreeData(treeId)`
2. Computes generations via existing `computeGenerations()`
3. Passes everything to `computeInsights()`, returns insight array
4. Groups by category, renders sections and cards
5. `useMemo` wraps computation, recalculates only when data changes

### Shared tree support

Insights page works for shared trees (read-only by nature). Journal entries excluded per sharing design.

## i18n

All insight messages use translation keys with interpolation: `t("insights.addictionAcrossGenerations", { count: 3 })`. Category names reuse existing keys (`trauma.category.addiction`, `dsm.neurodevelopmental`). Section headers and empty state are separate keys.

## Testing

### Unit tests (`computeInsights`)

- Generational: addiction in 3 generations produces correct insight
- Generational: classification shared across 2 generations produces insight
- Generational: single-generation tree produces no generational insights
- Temporal: 4 loss events at ages 32, 35, 37, 40 produces clustering insight
- Temporal: events spread evenly produces no clustering insight
- Temporal: 3 persons with diagnosis years produces average age insight
- Summary: 6 events across 3 persons produces count card
- Summary: 2 persons sharing classification produces shared insight
- Summary: fewer than 3 events produces no "most common" insight
- Resilience: turning point 3 years after trauma counts as "follows trauma"
- Resilience: turning point 10 years after trauma does not count
- Resilience: cycle_breaking in 2 generations produces insight
- Empty tree returns empty array
- Tree with 1 person and 1 event returns empty array (below thresholds)
- Priority sorting: generational insights rank above summary insights

### Component tests

- InsightsPage: renders section headers for populated categories, hides empty ones
- InsightsPage: shows empty state when no insights qualify
- InsightCard: renders message and detail line
- Toolbar: insights button navigates to correct route

### No backend changes

No server changes needed. All computation is client-side.
