# Timeline View Redesign

## Problem

The current timeline is a passive Gantt chart. It displays data but doesn't help users see what matters most: intergenerational patterns. Specific problems:

1. **No pattern visibility.** Recurring themes across generations (e.g. parentification, addiction cycles) aren't surfaced visually. Users must spot them manually.
2. **Too passive.** The timeline is read-only. Users must navigate back to the tree canvas to edit events, breaking their analytical flow.
3. **Wrong mental model.** A horizontal Gantt with absolute years shows when things happened, but not the more revealing question: at what age? A grandmother's trauma at age 12 and a mother's at age 13 sit far apart on an absolute axis but are strikingly close on an age-aligned one.

## Purpose and Mental Model

The redesigned timeline is a **reflection workspace**, not just a visualization. It serves three purposes:

1. **See the big picture.** All persons, events, and classifications laid out across time, with visual density showing where life got complicated.
2. **Spot patterns.** Age-aligned mode reveals same-age repetitions across generations. Pattern arcs explicitly mark intergenerational themes.
3. **Edit in context.** Add, modify, and annotate events directly on the timeline without switching views.

The mental model: "I'm laying out my family's stories side by side to understand what repeats and why."

## Dual-Axis Modes

### Years Mode (horizontal, default)

The familiar layout, refined:

- **X-axis**: Absolute calendar years, scrollable and zoomable.
- **Y-axis**: Generational rows. Grandparents at top, children at bottom. Within a generation, one horizontal lane per person.
- **Content per lane**: Life bar (birth to death/present), trauma event markers (circles, colored by category), life event markers (squares, colored by category), classification period strips (horizontal bars below the life bar, amber for suspected, blue for diagnosed).
- Partner relationship lines connect partner lanes with dashed connectors annotated with relationship periods.

### Age Mode (vertical)

The orientation flips completely to reveal developmental patterns:

- **Y-axis**: Age, flowing downward (0 at top, 90 at bottom). Life progresses "down the page" like reading.
- **X-axis**: Generations as columns, side by side. Grandparents on the left, parents in the middle, you on the right. Each person gets a vertical lane within their generation's column.
- **Column headers**: Generation label and person names, fixed at top during vertical scroll.
- **Life bars become vertical strips** with events as horizontal notches, making the timeline feel like a ruler or growth chart.

**What age mode reveals:**

- Same-age patterns jump out horizontally. If grandma had her first trauma at age 12, mom at age 13, and you at age 11, those markers form a near-horizontal line across the columns.
- Developmental stages align naturally. Childhood (0-12), adolescence (12-18), early adulthood (18-30) form horizontal bands. You can see what happened to each generation during the same life phase.

**Scroll and zoom:**

- Vertical scroll moves through ages; horizontal scroll (or pan) moves across generations.
- Zoom controls the age-axis density (how many years per pixel).

**Mode transition:**

- A toggle in the toolbar switches between "Years" and "Age".
- The two modes render as distinct layouts (not a literal rotation). Toolbar, filters, and interaction model stay identical across both modes.

## Interaction Layers

### Layer 1: Explore and Filter

Default mode. No accidental edits possible.

- **Hover** a marker: tooltip with event title, date/age, category, severity/impact.
- **Click** a person lane: highlights that person's lane, dims others. Shows a summary card.
- **Click** an event marker: highlights it and shows detail in a tooltip or mini-card.
- **Filter panel**: comprehensive filtering (see Filtering section below).

### Layer 2: Edit

Activated via toolbar toggle. Visual cue: subtle border or background tint change so the user knows they're in edit mode.

- **Click** an empty spot on a person's lane: "Add event here" popover with pre-filled date/age based on click position.
- **Click** an existing marker: opens the event detail in a side panel (same panels used in tree view) for editing.
- **Drag** a marker along the time axis: change its date/age. Shows a confirmation tooltip on release: "Move [event] to [new date]? Confirm / Cancel".
- **All mutations go through confirmations** to prevent accidental changes. A small confirmation popover appears for every edit action.

### Layer 3: Annotate and Reflect

Activated via toolbar toggle. For creating and viewing pattern arcs.

- **Click** event markers to select them (multi-select). Selected markers get a highlight ring.
- **Click** "Create pattern": floating mini-form to name the pattern and add a reflection note.
- **Existing patterns** render as translucent arcs connecting their linked events.
- **Click** an arc: opens pattern detail in a side panel.
- Pattern arcs can be toggled on/off globally or filtered individually.

## Pattern Arcs

Pattern arcs are the visual layer that transforms the timeline from a data display into a reflection tool.

**Visual treatment:**

- A pattern arc is a translucent colored band connecting related events across persons/generations. In years mode (horizontal), it's a vertical band spanning rows. In age mode (vertical), it's a horizontal band spanning columns.
- Each arc has a label (user-written) and links to specific events.
- Arcs use the accent color palette with low opacity (0.08-0.12), so they tint the background without obscuring event markers.
- Multiple overlapping arcs stack with additive blending, creating darker zones where patterns converge.

**Creating a pattern:**

- In annotate mode: click event markers to select them, then click "Create pattern". A floating mini-form appears to name the pattern and optionally add a reflection note.
- The arc auto-spans the age/year range of the selected events.
- Patterns are stored as existing Pattern entities (linked_event_ids), reusing the domain model.

**Interaction:**

- Hover an arc: highlights all linked events, dims everything else. Shows the pattern name and note in a tooltip.
- Click an arc: opens a side panel showing full pattern detail with linked events listed and editable.
- Arcs can be toggled on/off globally via toolbar, or filtered by pattern.

**Age mode advantage:**

When events cluster at similar ages across generations, the horizontal arc in vertical mode creates a striking visual band at that age level, making intergenerational repetition unmissable.

## Toolbar and Controls

Top toolbar, consistent with tree view toolbar styling (32px button height, accent underline):

| Control | Description |
|---------|-------------|
| Mode toggle | "Years" / "Age" switch |
| Layer selector | Explore / Edit / Annotate (radio-style, shows active layer) |
| Filter button | Opens filter panel (badge shows active filter count) |
| Zoom +/- | Zoom the time/age axis |
| Fit to view | Auto-zoom to show all visible data |
| Pattern toggle | Show/hide pattern arcs globally |

The filter chip bar sits below the toolbar, showing active filters as removable chips. Only visible when filters are active.

## Filtering

Filters are organized as smart groups derived from the relationship graph, plus individual toggles.

### Filter Dimensions

1. **People**
   - Demographic groups: all women, all men, adopted persons
   - Role-based groups (inferred from relationships): mothers, fathers, grandparents, siblings, half-siblings, partners
   - Generation-based: generation 1, 2, 3, etc.
   - Individual person toggles (override group selections)

2. **Trauma categories**: loss, abuse, addiction, war, displacement, illness, poverty

3. **Life event categories**: family, education, career, relocation, health, other

4. **Classifications**: by DSM-5 category, by status (suspected/diagnosed)

5. **Time range**: slider to narrow the visible year/age span

### UX: Progressive Disclosure

- Single "Filter" button in toolbar. Default state: everything visible.
- Opens a filter panel (right side, consistent with other panels) with collapsible sections: People, Trauma, Life Events, Classifications, Time Range.
- Each section collapsed by default, showing header and count badge ("3 of 7 visible"). Expand to see checkboxes.
- **Quick filters** at the top: pre-built one-click combinations like "Show trauma only", "Show classifications only", "Mothers' life events".
- Active filters shown as removable chips below the toolbar.
- "Reset all" button always visible when any filter is active.

### Combining Filters

- Multiple selections combine additively within a dimension (selecting "Mothers" + "Generation 1" shows all mothers AND all generation 1 persons).
- Across dimensions, filters combine subtractively (selecting "Mothers" + "Abuse" shows abuse events for mothers only).
- Filtered-out items fade to 10% opacity rather than disappearing, preserving spatial context. A toggle switches between "dim" and "hide" modes.
- Filtering is purely client-side (in-memory decrypted data), so response is instant.

## Rendering Architecture

Hybrid React + D3:

- **D3 handles**: scales (`scaleLinear` for time/age axis), axis rendering, zoom/pan transforms via `d3-zoom`. D3 owns the math, not the DOM.
- **React handles**: all interactive elements. Person lanes, event markers, classification strips, pattern arcs, tooltips, popovers, side panels are all React components positioned using D3-computed coordinates.
- **SVG container**: a single `<svg>` managed by React. D3 zoom transform applied to a `<g>` group. React components inside use D3 scale outputs for `x`, `y`, `width`, `height`.

**Why hybrid:**

- React components get hover/click handlers, accessibility attributes, and CSS transitions for free.
- No D3 enter/update/exit ceremony; React's reconciler handles DOM diffing.
- Event markers and pattern arcs are interactive and benefit from React's component model (props, state, context).
- D3's scale and zoom math is excellent and doesn't need replacing.

## Data Architecture

No new backend work, no schema changes, no encryption changes.

- `useTreeData` provides persons, relationships, events, life events, classifications (already decrypted in memory).
- A new `useTimelineState` hook manages view-local state: active mode (years/age), zoom level, scroll position, active layer, selected person filters, visible pattern arcs.
- A new `useTimelineFilters` hook walks the relationship graph to build smart filter groups (who is a "mother", who is a "grandparent", etc.).
- Edit layer reuses `useTreeMutations` (same encrypt-then-save flow as tree canvas).
- Pattern CRUD uses existing pattern endpoints (`/trees/{id}/patterns`).
- All mutations go through the existing optimistic update + bulk sync pipeline.

**Person lane ordering:**

- Years mode: rows ordered by generation depth (grandparents top, children bottom), then by birth year within a generation.
- Age mode: columns ordered left-to-right by generation depth. Within a column, persons ordered by birth year (earliest = leftmost lane).

## Phased Implementation

### Phase 1: Foundation (React+D3 hybrid rewrite)

Replace the current pure-D3 `TimelineView` with the hybrid architecture. Years mode only (horizontal). Person lanes with life bars, trauma/life event markers, classification strips. Basic zoom and pan. No editing, no age mode, no patterns. Feature parity with current timeline on the new architecture.

### Phase 2: Interaction layers 1 and 2 (explore + edit)

Hover tooltips, click-to-select, person lane highlighting. Filter panel with all dimensions (people groups, trauma, life events, classifications, time range). Chip bar for active filters. Edit mode with inline editing of events from the timeline (reuses existing mutation hooks and detail panels). Edit confirmations.

### Phase 3: Age mode

Vertical layout with generation columns. Mode toggle in toolbar. Age-axis zoom and scroll. Distinct rendering path, shared interaction model.

### Phase 4: Pattern arcs and annotation layer

Layer 3: select events to create patterns. Pattern arc rendering (horizontal bands in age mode, vertical bands in years mode). Pattern side panel. Quick filter integration (filter by pattern).

Each phase is independently shippable and testable.
