# Timeline Settings Panel

## Problem

The settings panel shows canvas-specific options (grid, snap-to-grid, edge style, minimap) when on the timeline view. These are irrelevant to the timeline. The timeline needs its own view settings: toggling partner lines, classification strips, and year gridlines.

## Design

### View-aware SettingsPanel

Refactor `SettingsPanel` to accept a `viewTab` prop instead of hardcoding canvas settings:

```ts
interface ViewTab {
  label: string;
  content: ReactNode;
}
```

- First tab renders `viewTab.label` and `viewTab.content`
- Account tab stays unchanged
- Tab state becomes `"view" | "account"` instead of `"canvas" | "account"`
- Theme and language move into each page's view tab content (no longer owned by SettingsPanel)

Each page constructs its own view tab:
- **TreeWorkspacePage**: label "Canvas", content = grid/edge/marker/minimap toggles + theme + language
- **TimelinePage**: label "Timeline", content = partner lines/classifications/gridlines toggles + theme + language
- **PatternView**: label "Patterns", content = theme + language only

### Timeline settings

New `useTimelineSettings` hook (mirrors `useCanvasSettings`):

```ts
interface TimelineSettings {
  showPartnerLines: boolean;    // default: true
  showClassifications: boolean; // default: true
  showGridlines: boolean;       // default: false
}
```

Persisted to `localStorage` under `traumabomen-timeline-settings`.

### Rendering changes

- `showPartnerLines: false` skips `<PartnerLine>` components in `TimelineYearsContent`
- `showClassifications: false` skips classification strips and diagnosis triangles in `PersonLane` and `AgePersonLane`
- `showGridlines: true` renders vertical lines (years mode) or horizontal lines (age mode) at axis tick positions with `strokeOpacity: 0.15`

### Settings flow

`TimelinePage` owns `useTimelineSettings`, passes settings to `TimelineView`, which passes relevant booleans to children.

## Files

| File | Changes |
|------|---------|
| `hooks/useTimelineSettings.ts` | New hook |
| `hooks/useTimelineSettings.test.ts` | Tests |
| `components/tree/SettingsPanel.tsx` | Accept `viewTab` prop, remove canvas settings |
| `components/tree/SettingsPanel.test.tsx` | Update tests |
| `components/tree/CanvasSettingsContent.tsx` | New: extracted canvas view tab content |
| `components/tree/TimelineSettingsContent.tsx` | New: timeline view tab content |
| `pages/TreeWorkspacePage.tsx` | Pass canvas view tab to SettingsPanel |
| `pages/TimelinePage.tsx` | Pass timeline view tab, use `useTimelineSettings` |
| `pages/PatternViewPage.tsx` | Pass minimal view tab |
| `components/timeline/TimelineView.tsx` | Accept and pass through settings |
| `components/timeline/TimelineYearsContent.tsx` | Respect showPartnerLines, render gridlines |
| `components/timeline/TimelineAgeContent.tsx` | Render gridlines |
| `components/timeline/PersonLane.tsx` | Respect showClassifications |
| `components/timeline/AgePersonLane.tsx` | Respect showClassifications |
| `locales/en/translation.json` | New keys |
| `locales/nl/translation.json` | Dutch translations |
