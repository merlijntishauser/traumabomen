# Test Plan: Timeline > Age > Explore Mode

**Auto** = covered by Vitest unit/component tests. **Manual** = requires browser interaction.

## Prerequisites

- A tree with at least 3 persons across 2+ generations
- Persons with birth/death years
- Trauma events across different categories and persons
- Life events across different categories
- Classifications (both suspected and diagnosed, with periods and diagnosis year)
- At least one pattern linking events across persons
- Navigate to `/trees/{id}/timeline`, switch to **Age** layout, confirm **Explore** mode is active

## 1. Layout and Rendering

| # | Test | Expected | Auto |
|---|------|----------|------|
| 1.1 | Generation bands | Vertical column bands per generation, alternating fills, "Generation N" header text | Yes |
| 1.2 | Column headers | Each person has a name label centered in column header area | Yes |
| 1.3 | Name truncation | Names > 5 characters truncated to 4 + ".." (e.g. "Alexander" becomes "Alex..") | Yes |
| 1.4 | Age axis | Left strip shows age tick labels (0, 10, 20, ...), adapting to visible height | Yes |
| 1.5 | Vertical life bars | Filled rectangle from age 0 to death age (or current age), 12px wide, rounded corners | Yes |
| 1.6 | No life bar without birth year | Person without `birth_year` still has a column but no life bar | Yes |
| 1.7 | Trauma markers | Circles at age positions, colored by category | Yes |
| 1.8 | Life event markers | Rotated rects (diamonds) at age positions, colored by category | Yes |
| 1.9 | Classification strips | Vertical bars next to the life bar per period; amber = suspected, blue = diagnosed | Yes |
| 1.10 | Diagnosis triangles | Triangle marker at diagnosis age for diagnosed classifications | Yes |
| 1.11 | Marker labels | Text labels above each marker showing title/name (when enabled) | Yes |

## 2. Hover Tooltips

| # | Test | Expected | Auto |
|---|------|----------|------|
| 2.1 | Hover trauma circle | Tooltip: title, category, age, severity, linked persons | Yes |
| 2.2 | Hover life event diamond | Tooltip: title, category, age, impact (if present), linked persons | Yes |
| 2.3 | Hover classification strip | Tooltip: DSM category/subcategory, status + year range | Yes |
| 2.4 | Hover diagnosis triangle | Tooltip: DSM category/subcategory, "Diagnosed (year)" | Yes |
| 2.5 | Tooltip disappears on mouseout | Clean removal, no lingering tooltips | Yes |
| 2.6 | Tooltip follows cursor | Positioned near cursor, stays in viewport | Manual |

## 3. Person Selection

| # | Test | Expected | Auto |
|---|------|----------|------|
| 3.1 | Click person name in column header | Lane highlights, all others dim, PersonSummaryCard appears | Yes |
| 3.2 | Click same person again | Deselects: all columns return to normal, card disappears | Yes |
| 3.3 | Click background to deselect | `onSelectPerson(null)` called, selection clears | Yes |
| 3.4 | Click lane hit area | Person selected, PersonSummaryCard appears | Yes |
| 3.5 | Click different person | Selection moves, card updates to new person | Manual |
| 3.6 | Selection dims non-selected lanes | Non-selected columns get `tl-lane--dimmed`, labels get dimmed class | Yes |

## 4. PersonSummaryCard

| # | Test | Expected | Auto |
|---|------|----------|------|
| 4.1 | Card shows person name | Full name (not truncated) | Yes |
| 4.2 | Card shows year range | "1950 - present" for living, "1950 - 2020" for deceased | Yes |
| 4.3 | Card shows age | Calculated age string | Yes |
| 4.4 | Card shows count badges | Trauma (circle), life event (square), classification (triangle); only if count > 0 | Yes |
| 4.5 | No counts section when empty | Counts section omitted when all counts are zero | Yes |
| 4.6 | Close button deselects | Card disappears, person deselected | Yes |
| 4.7 | Card replaced when switching person | Select A, then B: card updates to B's data | Manual |
| 4.8 | Card disappears on marker click | Clicking a marker replaces card with MarkerDetailCard | Manual |

## 5. Marker Click (Explore Mode)

| # | Test | Expected | Auto |
|---|------|----------|------|
| 5.1 | Click trauma circle | `onClickMarker` called with `trauma_event` entity type, person selected | Yes |
| 5.2 | Click life event diamond | `onClickMarker` called with `life_event` entity type | Yes |
| 5.3 | Click classification strip | `onClickMarker` called with `classification` entity type | Yes |
| 5.4 | Click diagnosis triangle | `onClickMarker` called with `classification` entity type | Yes |
| 5.5 | Click same marker toggles off | MarkerDetailCard disappears, PersonSummaryCard reappears | Manual |
| 5.6 | Marker click stops propagation | No background deselect or spurious person-select triggered | Yes |

## 6. MarkerDetailCard

| # | Test | Expected | Auto |
|---|------|----------|------|
| 6.1 | Trauma event card | Title, category, date, severity (if > 0), person name | Yes |
| 6.2 | Life event card | Title, category, date, impact (if > 0), person name | Yes |
| 6.3 | Classification card | DSM category + subcategory, status, diagnosis year (if present), person name | Yes |
| 6.4 | Close button | Card disappears on X click | Yes |
| 6.5 | Unknown entity ID | Card returns null, nothing rendered | Yes |

## 7. Zoom Controls

| # | Test | Expected | Auto |
|---|------|----------|------|
| 7.1 | Zoom In button | Calls `zoomIn` action, vertical axis compresses (animated) | Yes |
| 7.2 | Zoom Out button | Calls `zoomOut` action, vertical axis expands (min 0.5x, max 20x) | Yes |
| 7.3 | Fit to View button | Calls `resetZoom` action, zoom resets to 1:1 | Yes |
| 7.4 | Scroll wheel zoom | In zoom mode (default), wheel zooms vertical axis relative to pointer | Manual |
| 7.5 | Pan when zoomed in | Click-drag pans within bounds, column headers stay pinned | Manual |
| 7.6 | Year ticks update on zoom | Age axis tick density adapts after zoom | Manual |

## 8. Scroll Mode Toggle

| # | Test | Expected | Auto |
|---|------|----------|------|
| 8.1 | Toggle renders when handler provided | 4 buttons (toggle + zoom in/out/reset) | Yes |
| 8.2 | Toggle not rendered without handler | Only 3 buttons (zoom in/out/reset) | Yes |
| 8.3 | Toggle calls handler on click | `onToggleScrollMode` called | Yes |
| 8.4 | Active class when scroll mode on | Button has `tl-zoom-controls__btn--active` class, Hand icon | Yes |
| 8.5 | No active class when scroll mode off | Button has no active class, Mouse icon | Yes |
| 8.6 | Wheel events pass through in scroll mode | d3 filter blocks wheel events, browser scrolls naturally | Manual |
| 8.7 | Zoom buttons still work in scroll mode | +/- and reset still trigger d3 zoom transitions | Manual |
| 8.8 | Scroll mode persists across layout switch | State at TimelinePage level, preserved when switching Years/Age | Manual |
| 8.9 | Scroll mode resets on page reload | `scrollMode` defaults to false | Manual |

## 9. Counter-scaling on Zoom

| # | Test | Expected | Auto |
|---|------|----------|------|
| 9.1 | Markers counter-scaled at zoomK > 1 | `scale(1, 1/zoomK)` transform applied to marker groups | Yes |
| 9.2 | No counter-scale at zoomK = 1 | No transform attribute on marker groups | Yes |
| 9.3 | Life bars scale with zoom | Bars represent time spans, grow with zoom (no counter-scale) | Manual |
| 9.4 | Marker labels counter-scaled | Text labels maintain constant visual size while zoomed | Manual |

## 10. Settings (Timeline tab)

| # | Test | Expected | Auto |
|---|------|----------|------|
| 10.1 | Show Classifications off | All classification strips and diagnosis triangles disappear | Yes |
| 10.2 | Show Classifications on | Strips and triangles reappear | Yes |
| 10.3 | Show Gridlines on | Horizontal lines at each age tick, full SVG width, muted at 25% opacity | Yes |
| 10.4 | Show Gridlines off (default) | No gridlines rendered | Yes |
| 10.5 | Show Marker Labels off | All text labels above markers disappear; tooltips still work | Yes |
| 10.6 | Show Marker Labels on (default) | Labels rendered above each marker | Yes |
| 10.7 | Settings persist across reloads | Stored in localStorage, restored on page load | Yes |

## 11. Dimming Behavior

| # | Test | Expected | Auto |
|---|------|----------|------|
| 11.1 | Filter-based lane dimming | Persons in `dimmedPersonIds` get `tl-lane--dimmed` class | Yes |
| 11.2 | Selection-based lane dimming | Non-selected persons dimmed when any person is selected | Yes |
| 11.3 | No dimming without selection or filters | All lanes at full opacity | Yes |
| 11.4 | Trauma marker dimming | Events in `dimmedEventIds` render at `opacity={0.15}` | Yes |
| 11.5 | Classification marker dimming | Classifications in `dimmedClassificationIds` render at `opacity={0.15}` | Yes |
| 11.6 | Dimmed markers hidden in hide mode | `filterMode="hide"` removes dimmed markers entirely | Manual |

## 12. Filter Panel

| # | Test | Expected | Auto |
|---|------|----------|------|
| 12.1 | Open filter panel | Filter icon opens panel from the right, badge shows count | Yes |
| 12.2 | Quick filter: Trauma only | Life events and classifications dim, trauma remains | Yes |
| 12.3 | Quick filter: Life Events only | Trauma and classifications dim | Yes |
| 12.4 | Quick filter: Classifications only | Trauma and life events dim | Yes |
| 12.5 | Quick filter toggle off | Clicking active pill resets category filters | Yes |
| 12.6 | People filter (individual) | Unchecking a person dims/hides their column | Yes |
| 12.7 | People filter (generation groups) | Toggling generation pill affects all members | Yes |
| 12.8 | Select All / Deselect All | Bulk toggle all person checkboxes | Yes |
| 12.9 | Trauma category filter | Unchecking category dims those markers | Yes |
| 12.10 | Life event category filter | Unchecking category dims those markers | Yes |
| 12.11 | Classification category filter | Unchecking DSM category dims strips/triangles | Yes |
| 12.12 | Classification status filter | Unchecking Suspected/Diagnosed dims by status | Yes |
| 12.13 | Time range filter | Events outside range dim | Yes |
| 12.14 | Dim vs Hide toggle | Dim: 15% opacity. Hide: removed from DOM | Yes |
| 12.15 | Reset All | All filters cleared, chip bar gone, mode resets to dim | Yes |

These are tested in `TimelineFilterPanel.test.tsx` (46 tests) and `useTimelineFilters.test.ts` (33 tests).

## 13. Chip Bar

| # | Test | Expected | Auto |
|---|------|----------|------|
| 13.1 | Chips visible when filters active | Chip bar below toolbar, one chip per filter dimension | Yes |
| 13.2 | Person chips | 1-2 hidden: individual name chips. 3+: summary "People: X/Y" | Yes |
| 13.3 | Remove chip | X on chip removes that filter | Yes |
| 13.4 | Category chips | One per hidden category, X re-enables | Yes |
| 13.5 | Time range chip | "1980 - 2000" format, X clears range | Yes |
| 13.6 | No chip bar without filters | Hidden when no filters active | Yes |

These are tested in `TimelineChipBar.test.tsx` (17 tests).

## 14. Pattern Arcs

| # | Test | Expected | Auto |
|---|------|----------|------|
| 14.1 | Arcs render for visible patterns | Semi-transparent colored vertical bands spanning linked entities' age range | Yes |
| 14.2 | Non-visible patterns hidden | Patterns not in `visiblePatternIds` not rendered | Yes |
| 14.3 | Single-point span padding | Same-age entities: span padded by +/-1 age unit | Yes |
| 14.4 | Age coordinates in vertical mode | Uses `age = year - birth_year` instead of calendar year | Yes |
| 14.5 | Hover highlights arc | Fill opacity increases (0.1 to 0.18), pattern label appears | Yes |
| 14.6 | Click opens pattern panel | `onPatternClick` called with pattern ID | Yes |
| 14.7 | Eye toggle hides all arcs | `visiblePatternIds` becomes empty set | Manual |

## 15. Keyboard Navigation

| # | Test | Expected | Auto |
|---|------|----------|------|
| 15.1 | Escape closes MarkerDetailCard | Card closes, person stays selected, PersonSummaryCard reappears | Manual |
| 15.2 | Escape deselects person | Person deselected, card disappears | Manual |
| 15.3 | Escape closes filter panel | Panel closes | Manual |
| 15.4 | Escape priority order | Entity selection > pattern panel > selected person > filter panel > exit mode | Manual |

These require full TimelinePage rendering with all hooks mocked, which is impractical as unit tests. Best verified manually or via Playwright.

## 16. Edge Cases

| # | Test | Expected | Auto |
|---|------|----------|------|
| 16.1 | Empty tree | "No data to display" message, no SVG rendered | Yes |
| 16.2 | Person without birth year | Column present but no life bar | Yes |
| 16.3 | Non-numeric event date | Marker skipped silently | Yes |
| 16.4 | Filter state resets on reload | In-memory state, not persisted | Manual |
| 16.5 | Scroll mode resets on reload | Defaults to false (zoom mode) | Manual |
