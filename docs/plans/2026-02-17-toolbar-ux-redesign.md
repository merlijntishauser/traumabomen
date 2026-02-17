# Toolbar UX Redesign

## Problem

The current toolbar mixes navigation and actions in one flat row of identical-looking icon buttons. Users cannot tell which buttons navigate to another page and which toggle a panel or trigger an action. The pattern feature has two icon buttons (view page link + panel toggle) that look and label identically.

## Design

### Principle: separate navigation from actions

Three visual zones in the toolbar, left to right:

1. **Identity** -- tree name (or page title for admin)
2. **View tabs** -- segmented pill group for switching between Canvas, Timeline, and Patterns views. Active tab is highlighted. Only present on tree workspace pages.
3. **Page actions** -- text buttons for actions specific to the current view (e.g. "Add person", "Auto-layout", "Edit patterns" on canvas). Empty when the current view has no actions.
4. **Utility** -- icon buttons for global functions: Home, Settings, Logout.

### Tab styling

- Compact pill group: `border: 1px solid var(--color-border-primary); border-radius: var(--radius-sm)`
- Active tab: `background: var(--color-accent); color: var(--color-text-inverse)`
- Inactive tab: `background: transparent; color: var(--color-text-secondary)`
- Hover on inactive: `background: var(--color-bg-hover)`
- Font size: 13px, padding: 4px 14px
- Tabs are `<Link>` or `<NavLink>` elements

### Per-page layout

**Canvas:**
```
[Tree Name]  ...  [Canvas* | Timeline | Patterns]  |  [Add person] [Auto-layout] [Edit patterns]  |  [Home] [Settings] [Logout]
```

**Timeline:**
```
[Tree Name]  ...  [Canvas | Timeline* | Patterns]  |  [Home] [Settings] [Logout]
```

**Patterns view:**
```
[Tree Name]  ...  [Canvas | Timeline | Patterns*]  |  [Home] [Settings] [Logout]
```

**Admin** (no view tabs, no SettingsPanel -- keep Theme toggle):
```
[Admin]  ...  [Home] [Theme] [Logout]
```

### Changes

- Remove ThemeToggle from canvas/timeline/patterns toolbars (accessible via Settings panel)
- Remove pattern navigation icon from canvas toolbar (covered by tab)
- Remove pattern panel toggle icon; replace with text button "Edit patterns"
- Remove timeline icon from canvas toolbar (covered by tab)
- Remove canvas icon from timeline/patterns toolbar (covered by tab)
- Remove home icon from canvas/timeline/patterns (covered by tab... wait, Home goes to /trees, not a view tab). Keep Home icon in utility group.
- New CSS class: `.tree-toolbar__tabs` (the pill group) and `.tree-toolbar__tab` (individual tab, with `--active` modifier)
