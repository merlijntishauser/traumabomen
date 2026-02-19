# Manual Test Plan: Timeline > Years > Explore Mode

## Prerequisites

- A tree with at least 3 generations (grandparents, parents, children)
- Multiple persons per generation (at least 2)
- Trauma events across different categories and persons
- Life events across different categories
- Classifications (both suspected and diagnosed, with periods)
- At least one partner relationship with periods
- At least one pattern linking events across generations

## 1. Layout and Rendering

| # | Test | Expected |
|---|------|----------|
| 1.1 | Navigate to timeline view | Years mode loads by default, horizontal layout |
| 1.2 | Generational rows | Grandparents at top, children at bottom. Within a generation, persons ordered by birth year |
| 1.3 | Generation bands | Alternating background bands per generation with "Generation 1/2/3" labels |
| 1.4 | Person labels | Left sidebar shows person names, one per row |
| 1.5 | X-axis | Calendar year ticks across top |
| 1.6 | Life bars | Rounded rectangles from birth year to death year (or present for living persons) |
| 1.7 | Trauma markers | Circles on the life bar, colored by category |
| 1.8 | Life event markers | Diamonds/squares on the life bar, colored by category |
| 1.9 | Classification strips | Horizontal bars below the life bar per classification period; amber for suspected, blue for diagnosed |
| 1.10 | Partner lines | Dashed connectors between partner lanes with period annotations |

## 2. Zoom and Pan

| # | Test | Expected |
|---|------|----------|
| 2.1 | Scroll-wheel zoom | Horizontal axis zooms in/out, year density changes |
| 2.2 | Pinch-to-zoom (trackpad) | Same behavior as scroll zoom |
| 2.3 | Pan (drag) | Horizontal panning along the time axis |
| 2.4 | Label column stays fixed | Person name sidebar does not scroll horizontally |
| 2.5 | Year ticks update on zoom | Tick density adapts (more ticks when zoomed in) |
| 2.6 | Gridlines respect zoom | When enabled, vertical gridlines move with zoom/pan |

**Potential gap**: Design doc specifies zoom +/- buttons and "fit to view" button in toolbar. These are not implemented (zoom only works via scroll/pinch).

## 3. Hover Tooltips

| # | Test | Expected |
|---|------|----------|
| 3.1 | Hover trauma marker | Tooltip shows: title, category, approximate date, severity, linked persons |
| 3.2 | Hover life event marker | Tooltip shows: title, category, approximate date, impact, linked persons |
| 3.3 | Hover classification strip | Tooltip shows: DSM category, status, period range |
| 3.4 | Hover diagnosis triangle | Tooltip shows: classification details with diagnosis year |
| 3.5 | Hover partner line | Tooltip shows: partner names, status (together/married/etc.), period |
| 3.6 | Tooltip follows mouse | Tooltip positioned near cursor, stays in viewport |
| 3.7 | Tooltip disappears on mouseout | Clean removal, no lingering tooltips |

## 4. Person Selection (Click Interaction)

| # | Test | Expected |
|---|------|----------|
| 4.1 | Click person name label | That person's lane highlights, all others dim |
| 4.2 | Click person's life bar area | Same: lane highlights, others dim |
| 4.3 | Click same person again | Person deselects? Or stays selected? (verify behavior) |
| 4.4 | Click different person | Selection moves to new person |
| 4.5 | Click empty background | Deselects current person, all lanes return to full opacity |
| 4.6 | Dimming appearance | Non-selected persons render at reduced opacity (0.15), labels get dimmed class |

**Potential gap**: Design doc says clicking a person lane "shows a summary card." Verify whether any summary card/panel appears, or if it only highlights.

## 5. Event Marker Click (Explore Mode)

| # | Test | Expected |
|---|------|----------|
| 5.1 | Click a trauma marker | Design: "highlights it and shows detail in a tooltip or mini-card" |
| 5.2 | Click a life event marker | Same expected behavior |
| 5.3 | Click a classification strip | Same expected behavior |

**Known gap**: The `onClickMarker` callback exists in PersonLane but is not wired to any action in TimelinePage. Clicking markers in explore mode likely does nothing visible beyond the tooltip.

## 6. Filter Panel

| # | Test | Expected |
|---|------|----------|
| 6.1 | Click filter button in toolbar | Filter panel opens on right side |
| 6.2 | Badge shows active count | When filters active, badge number on filter button |
| 6.3 | Sections collapsed by default | People, Trauma, Life Events, Classifications, Patterns, Time Range all collapsed |
| 6.4 | Section badges | Each header shows "X of Y" when filtered |
| 6.5 | Expand People section | Smart groups (demographic, roles, generations) + individual checkboxes |
| 6.6 | Toggle "All women" group | All female persons dim/hide, filter count updates |
| 6.7 | Toggle individual person | That person dims/hides |
| 6.8 | Toggle trauma category | Trauma markers of that category dim/hide across all persons |
| 6.9 | Toggle life event category | Life event markers of that category dim/hide |
| 6.10 | Toggle classification category | Classification strips of that category dim/hide |
| 6.11 | Toggle classification status | Only suspected or only diagnosed shown |
| 6.12 | Set time range | Only events within range visible |
| 6.13 | Quick filter: "Trauma only" | All life events and classifications dim/hide, only trauma visible |
| 6.14 | Quick filter: "Life events only" | Same but for life events |
| 6.15 | Quick filter: "Classifications only" | Same but for classifications |
| 6.16 | Dim vs Hide toggle | Dim: filtered items at 0.15 opacity. Hide: filtered items fully removed |
| 6.17 | Reset all | All filters cleared, everything visible again |

## 7. Chip Bar

| # | Test | Expected |
|---|------|----------|
| 7.1 | Chips appear when filtering | Removable chips show below toolbar for each active filter |
| 7.2 | Remove chip | Clicking X on a chip removes that specific filter |
| 7.3 | Multiple chips | Each filter dimension can create chips simultaneously |
| 7.4 | Chips hidden when no filters | Chip bar not visible when all filters are cleared |

## 8. Pattern Arcs (in Explore Mode)

| # | Test | Expected |
|---|------|----------|
| 8.1 | Patterns visible | When pattern toggle is on, translucent vertical bands span linked event rows |
| 8.2 | Hover a pattern arc | All linked events highlight, everything else dims; shows pattern name/note |
| 8.3 | Click a pattern arc | Opens pattern detail (side panel or navigation) |
| 8.4 | Pattern toggle off | Arcs hidden when eye button toggled off |
| 8.5 | Filter by specific pattern | In filter panel, select a pattern to dim non-linked events |

## 9. Mode Indicator and Safety

| # | Test | Expected |
|---|------|----------|
| 9.1 | Default mode is Explore | Toolbar shows Explore as active |
| 9.2 | No edit actions possible | Clicking empty lane space does NOT open "add event" popover |
| 9.3 | No drag possible | Markers cannot be dragged in explore mode |
| 9.4 | No selection rings | Entity selection rings (annotate mode) not visible |

## Known Gaps (Design Doc vs Implementation)

Based on code analysis, these are likely to fail:

1. **Explore mode marker click** (5.1-5.3): `onClickMarker` is not wired to any UI action in TimelinePage; clicking markers likely does nothing beyond tooltip
2. **Person selection summary card** (4.1): No summary card/panel appears on person selection, only dimming of other lanes
3. **Zoom +/- buttons**: Not in toolbar (zoom only via scroll/pinch)
4. **Fit to view button**: Not implemented
5. **Edit mode interactions** (not in scope for this test plan, but noted: 0% implemented beyond mode switching)

Recommend testing items 5.1-5.3 and 4.1 first since those are the most likely "not yet working as planned" areas.
