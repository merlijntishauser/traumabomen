# Events Tab Grouping

## Problem

The PersonDetailPanel has 6 top-level tabs (Person, Relationships, Trauma, Life, Turning Points, DSM-5). This is too many; the last tab gets cut off on smaller screens and the tab bar feels cluttered.

## Design

Merge the three event types (trauma, life, turning points) under a single "Events" tab with a segmented control inside the content area to switch between sub-types.

### Tab structure

Before: `[Person] [Relations 2] [Trauma] [Life] [Turning Points] [DSM-5]` (6 tabs)

After: `[Person] [Relations 2] [Events 5] [DSM-5 1]` (4 tabs)

The Events tab badge shows the total count across all three types.

### Segmented control

When the Events tab is active, a segmented control appears at the top of the content area:

```
  ┌─────────────────────────────────────┐
  │ (o Trauma)  ([] Life)  (* Turning)  │
  └─────────────────────────────────────┘
```

Each segment shows the badge shape (circle, square, star) matching the canvas. The active segment uses the accent color. Sub-type selection is remembered in React state (not persisted).

Badge clicks on canvas nodes open the correct sub-type automatically.

### Content

The content below the segmented control is the existing tab component for that type (TraumaEventsTab, LifeEventsTab, TurningPointsTab). No changes to forms or lists.

## Files

### Modify
- `frontend/src/components/tree/PersonDetailPanel.tsx` (tab restructuring, segmented control)
- `frontend/src/components/tree/PersonDetailPanel.css` (segmented control styles)
- `frontend/src/components/tree/PersonDetailPanel.test.tsx` (update tab count, add segment tests)

### Unchanged
- TraumaEventsTab, LifeEventsTab, TurningPointsTab (content components)
- TreeWorkspacePage, TimelinePage (callbacks unchanged)
- Backend (no changes)
