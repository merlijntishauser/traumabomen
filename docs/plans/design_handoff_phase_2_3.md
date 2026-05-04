# Design handoff — Phase 2/3 plan

Phase 1 of `docs/design_handoff/README.md` (token + brand-rule sync) landed
directly on main. This file lists the remaining work for Phases 2 (atoms)
and 3 (screens) so it can be picked up incrementally without re-doing the
audit.

## What Phase 1 already did

- Added `--shadow-glass` token to `theme.css` (dark + light).
- Added semantic type-role tokens (`--text-h1-*`, `--text-h2-*`, …,
  `--text-eyebrow-*`) and `.t-h1` / `.t-h2` / `.t-tagline` / `.t-body` /
  `.t-small` / `.t-micro` / `.t-eyebrow` / `.t-label` helper classes.
- Bumped `h1` from `1.75rem` weight 200 → `2rem` weight 200 (matches design).
- Migrated three hard-coded `0 8px 40px rgba(0,0,0,0.35)` shadows in
  `auth.css` to `var(--shadow-glass)`.
- Extended `AGENTS.md` design system section with brand-voice rules,
  "what we don't do", and the body-15px / sentence-case / Lucide-only /
  no-glass-on-data-dense / no-emoji rules from the SKILL.md.

## Phase 2 — atom audit

Compare each existing component against `docs/design_handoff/ui_kits/traumatrees-app/components.jsx`.
The kit defines `tt-*` classes; our codebase uses domain-named classes.
The goal is **parity of styling and anatomy**, not renaming everything.

### Confirmed deltas

| Atom | Current | Design | Action |
|---|---|---|---|
| `input[type=text]`/`select`/`textarea` base | `font-size: 14px` in `theme.css` | 15px | Bump to 15px or `var(--text-body-size)`. Audit visual impact on dense forms (PersonDetailPanel). |
| `.btn` | `padding: var(--space-1.5) var(--space-3.5)` (6px 14px), `font-size: 13px` | `tt-btn`: `padding: 9px 16px`, `font-size: 13px` | Bump `.btn` padding to `9px 16px` (or `var(--space-2.5) var(--space-4)`). Verify toolbar/footer button heights still align (32px/24px rule from AGENTS.md). |
| Glass card | Hard-coded `rgba(10, 26, 15, 0.78)` background, `1px solid rgba(31, 77, 53, 0.5)` border in `auth.css` | Same values, but should be a single rule applied via class | Extract `.tt-card--glass` (or `.glass-card`) into `theme.css` so the lock screen and auth modal share one definition. |
| `Eyebrow` | None | `.tt-eyebrow` (10px / 600 / uppercase / 0.05em tracking) | Already covered by Phase 1's `.t-eyebrow` helper class; just consume it. |
| `Logomark` | Inline SVG in `AppFooter` | Standalone `<Logomark>` component in `components.jsx` | Extract `frontend/src/components/Logomark.tsx` consuming the SVG from `components.jsx`. |
| `Logo` (`Logomark + word`) | Currently the wordmark is plain `<h1>` | `<Logo size withWord>` component | Optional — ship `Logomark.tsx` first; only add `Logo` if a screen needs it. |
| `Badge` | Per-feature classes (`detail-panel__category-pill`, etc.) | `tt-badge--neutral` / `tt-badge--accent` / `tt-badge--<trauma>` etc. | Audit existing badge usages. The shape (circle/square/triangle by entity type) is locked by AGENTS.md and must stay. The kit's badges are pill-style — only adopt where AGENTS doesn't already specify shape. |
| `IconButton` | None | 34×34, transparent, hover bg shifts | Likely needed for theme toggle, feedback button. Compare to existing `ThemeToggle` and migrate. |
| `Checkbox` | Native `<input type="checkbox">` (varies per place) | Custom 16×16 box, accent fill on check | Not done. Current code uses native checkboxes, which AGENTS.md endorses (`detail-panel__field--checkbox`). Defer unless a designer flags the native styling as wrong. |
| `FieldGroup` | Per-screen sub-tinted containers | `.tt-field-group`: `rgba(255,255,255,0.03)` bg, 1px secondary border, `radius-md`, 16px padding, 14px gap | Add a shared `.field-group` class in `theme.css` so register/login forms can drop their bespoke groupings. |

### Risk flags

- Changing input font-size from 14 → 15px will cascade through every form
  in the app. Likely safe, but verify in PersonDetailPanel (densest form),
  RegisterPage stepper, and admin tables.
- `.btn` padding change will shift toolbar button width by 4px. The
  AGENTS.md rule "all toolbar buttons share `height: 32px`" must still
  hold; verify the explicit `height` overrides win.

### Recommended commit order (Phase 2)

1. `theme.css`: bump default input font-size to 15px. Watch tests + screenshots.
2. `theme.css`: bump `.btn` padding. Watch tests + toolbar layout.
3. Extract `.field-group` shared class (used by auth + person panel).
4. Extract `Logomark` component, swap inline SVG in `AppFooter`.
5. Audit badge usages — most stay shape-locked; only convert the few
   pill-style places (`detail-panel__category-pill`).

## Phase 3 — screen alignment

Three reference screens map to existing pages:

| Reference | Target |
|---|---|
| `AuthLanding.jsx` | `RegisterPage.tsx`, `LoginPage.tsx`, `UnlockPage.tsx` |
| `TreeList.jsx` | `TreeListPage.tsx` |
| `Workspace.jsx` | `TreeWorkspacePage.tsx` |

Workspace is the biggest divergence. The kit fakes a canvas with absolute
divs; our implementation is React Flow. The goal is **node, edge, and
side-panel styling parity** — don't replace React Flow.

### Suggested approach

1. Side-by-side review: open the dev server and the kit's `index.html`
   (it bundles Babel-in-the-browser, suitable for local preview only).
2. Pixel-spot the differences per screen. Lock down the gaps in this file
   under "Phase 3 deltas" before touching code.
3. One commit per screen, kept narrow. Visual regressions are easy to
   catch with the existing Playwright e2e tests + manual review.

### Out of scope

- Don't import any `ui_kits/traumatrees-app/*.jsx` file into the build.
  They use Babel-in-the-browser and are reference, not production.
- Don't introduce the `tt-*` class system globally. Keep the existing
  domain-named classes; only borrow the kit's atoms or class names where
  it materially reduces duplication.

## Reference files

- `docs/design_handoff/colors_and_type.css` — token source of truth
- `docs/design_handoff/README_design_system.md` — voice + visual fundamentals
- `docs/design_handoff/SKILL.md` — short rules-of-the-road (now folded into AGENTS.md)
- `docs/design_handoff/ui_kits/traumatrees-app/components.jsx` — atom anatomy
- `docs/design_handoff/ui_kits/traumatrees-app/AuthLanding.jsx`
- `docs/design_handoff/ui_kits/traumatrees-app/TreeList.jsx`
- `docs/design_handoff/ui_kits/traumatrees-app/Workspace.jsx`
