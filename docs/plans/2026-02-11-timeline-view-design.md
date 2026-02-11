# Timeline View

## Overview

A D3 horizontal timeline at `/trees/:id/timeline` showing persons as rows grouped by generation, with trauma event markers and partner period bars.

## Layout

Full-page view with a toolbar at top (back link to tree, logout) and D3 SVG filling the rest.

The SVG has a fixed-width label column (~160px) on the left for person names and generation labels. The right side is the zoomable time area.

Three visual layers:
- **Background**: generational band rectangles (alternating subtle gray/white) spanning full width, with generation label in the left margin
- **Middle**: person rows within each band, each showing a life-span bar (birth to death/current year) with name label
- **Foreground**: trauma event circles colored by category, and partner period lines between partner rows

## Component Architecture

**`pages/TimelinePage.tsx`** -- Page component. Uses `useTreeData` for decrypted data, renders toolbar + `<TimelineView>`.

**`components/timeline/TimelineView.tsx`** -- D3 visualization. Receives persons, relationships, events as props. Uses a ref to an SVG element, runs D3 in a `useEffect`. Computes generations, builds scales, renders all visual elements, handles zoom and tooltip.

**`components/timeline/TimelineView.css`** -- SVG container and tooltip styles.

No new hooks or mutations -- the timeline is read-only.

## D3 Rendering

**Time scale**: `d3.scaleLinear` mapping years to pixels. Domain: `[minYear - 5, maxYear + 5]` derived from birth/death years. Range: `[labelColumnWidth, svgWidth]`.

**Row layout**: 36px per person row, 4px padding. Sorted by generation depth (ascending), then birth year within generation. Generation bands get a 20px header row.

**Generation inference**: Walk parent relationships. Persons with no parents = generation 0. Children = parent generation + 1.

**Life bars**: Rounded rectangles, 12px tall, light blue fill (`#dbeafe`), border `#93c5fd`.

**Event markers**: Circles radius 7, positioned at parsed year from `approximate_date`. Filled with `TRAUMA_COLORS[category]`, white stroke. Events linked to multiple persons render on each person's row. Mouseenter shows tooltip, mouseleave hides it.

**Partner periods**: Horizontal line segments between partner rows at the time range of each period. Pink (`#ec4899`). Dashed for `separated`/`divorced`.

**Tooltip**: Absolutely positioned div over the SVG, managed via D3 event handlers (not React state). Shows: event title, category (translated), approximate date, severity, linked person names.

**Zoom**: `d3.zoom`, horizontal only. Rescales time axis and all x-positioned elements. Label column stays fixed.

**Axis**: `d3.axisTop` year axis at top of the time area.

## Files

**New:**
- `frontend/src/components/timeline/TimelineView.tsx`
- `frontend/src/components/timeline/TimelineView.css`
- `frontend/src/pages/TimelinePage.tsx`

**Modified:**
- `frontend/src/App.tsx` -- add `/trees/:id/timeline` route
- `frontend/src/locales/en/translation.json`
- `frontend/src/locales/nl/translation.json`

## i18n Keys

- `timeline.generation`: "Generation {{number}}" / "Generatie {{number}}"
- `timeline.severity`: "Severity: {{value}}" / "Ernst: {{value}}"
- `timeline.noData`: "No data to display. Add persons and events in the tree view." / "Geen gegevens om weer te geven. Voeg personen en gebeurtenissen toe in de boomweergave."
