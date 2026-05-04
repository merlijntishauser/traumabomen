# Handoff: Traumabomen / Traumatrees — Design System Sync

## Overview

This bundle is the design-side source of truth for the **traumabomen** web app (zero-knowledge encrypted intergenerational trauma mapping; `traumabomen.nl` / `traumatrees.org`). The repo it targets is `merlijntishauser/traumabomen` — a React 19 + Vite frontend.

Goal of this handoff: **bring the codebase into alignment with this design system**, then keep them in sync going forward.

## About the design files

The files in this bundle are **design references** — HTML/JSX prototypes showing intended look, tokens, and behaviour. They are **not production code to drop in**. The task is to **adopt the tokens and patterns into the existing `frontend/` codebase** (React 19 + Vite + react-i18next + react-router + lucide-react), not to copy the JSX files verbatim.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, shadows, and component anatomy are settled. Pixel-perfect implementation expected.

## What's in this bundle

| File / folder | What it is | What to do with it |
|---|---|---|
| `colors_and_type.css` | Every design token (colors, fonts, spacing, radii, shadows, motion) for dark + light themes | **Adopt as-is.** Replace the equivalent block in `frontend/src/styles/theme.css`. Token names match the existing `--color-*` / `--space-*` / `--radius-*` / `--shadow-*` convention. |
| `README_design_system.md` | Full content + visual fundamentals reference. Voice, hover/focus rules, photography character, "what we do NOT do" list | Read first. Source of truth for non-token decisions (microcopy tone, when to use glass vs. solid cards, etc.). |
| `SKILL.md` | Short rules-of-the-road file | Drop into `CLAUDE.md` or `.cursor/rules/` so AI tooling enforces the system. |
| `ui_kits/traumatrees-app/` | React + Babel recreation of three screens + shared atoms | Reference for component anatomy. **Don't import these files into the build** — they use Babel-in-the-browser. Translate the JSX into proper React components in `frontend/src/components/`. |
| `assets/` | `favicon.svg`, `leaf-motif.svg`, four hero `.webp`s | Already in `frontend/public/` — diff to confirm match. |

## Sync plan (recommended order)

### 1. Tokens

Open `colors_and_type.css` and `frontend/src/styles/theme.css` side-by-side. Replace the token block. Watch for these additions/changes vs. the current repo:

- `--color-text-inverse` is the label color for buttons sitting on `--color-accent`.
- Half-step spacing (`--space-0.5`, `--space-1.5`, `--space-2.5`, `--space-3.5`) is first-class.
- `--shadow-glass` is a separate recipe used **only** on auth/lock cards over photography.
- `--color-tp-cycle-breaking`, `--color-tp-protective-relationship`, `--color-tp-recovery` (turning-point colors) and the trauma category palette (`--color-trauma-loss`, `--color-trauma-abuse`, `--color-trauma-addiction`, `--color-trauma-war`, `--color-trauma-displacement`, `--color-trauma-illness`, `--color-trauma-poverty`) are defined here.

### 2. Atoms

Compare `ui_kits/traumatrees-app/components.jsx` against `frontend/src/components/`. The atoms there (`Button`, `IconButton`, `Field`, `Input`, `Textarea`, `FieldGroup`, `Checkbox`, `Badge`, `Eyebrow`, `Card`, `Divider`, `Logo`, `Logomark`) are how the system wants every primitive to look. Migrate component-by-component into the existing component file structure, **using `lucide-react` for icons** rather than the inline SVGs in this bundle.

Critical rules to lock in while you migrate:
- Headings always **light weight** (200–400). Never bold the handwriting face.
- Body is **15px** (not 14, not 16).
- **No emoji.** Anywhere. (The MentalHealthBanner currently has none — keep it that way.)
- **Sentence case** for every label including buttons.
- All transitions go through `var(--transition-colors)` (0.15s ease). **No press shrink, no scale transforms, no springs.**
- **No glassmorphism on data-dense surfaces.** Glass only on auth/lock cards over hero photography.

### 3. Screens

The three reference screens map to existing pages:

| Reference (`ui_kits/traumatrees-app/`) | Target page in repo |
|---|---|
| `AuthLanding.jsx` | `frontend/src/pages/RegisterPage.tsx`, `LoginPage.tsx`, `UnlockPage.tsx` (share `AuthHero` + glass card pattern) |
| `TreeList.jsx` | `frontend/src/pages/TreeListPage.tsx` |
| `Workspace.jsx` | `frontend/src/pages/WorkspacePage.tsx` (or whatever hosts the React Flow canvas) |

For the workspace, the bundle uses hand-laid absolute-positioned divs to fake a canvas — your real implementation should keep using **React Flow** but apply the node, edge, and side-panel styling shown in `Workspace.jsx`.

### 4. CSS file structure

Existing repo uses one CSS file per surface (`auth.css`, `tree-list.css`, `admin.css`, `footer.css`). Keep that pattern. Token file (`theme.css`) stays the only place colors/fonts/etc. are defined.

## Design tokens summary

All tokens are documented inline in `colors_and_type.css` with comments. Highlights:

- **Fonts**: `--font-heading` = `"Playwrite NZ Basic", Georgia, cursive` (weights 100–400). `--font-body` = `"Lato", -apple-system, …` (weights 300/400/700/900 + italic 400).
- **Accent**: `--color-accent` = forest green (`#2d8a5e` dark / `#1f6b48` light).
- **Spacing**: 4px base, half-steps included.
- **Radius**: `--radius-sm` (6) / `--radius-md` (8) / `--radius-lg` (12). No pills, no hard squares.
- **Shadows**: `--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--shadow-glass`. Soft, low-contrast, faint green tint.

## Photography & assets

- 4 hero `.webp`s, all forest scenes, no faces. Dark + light variants for the auth landing; a separate `hero-unlock-dark.webp` for the unlock page; `welcome-dark.webp` / `welcome-light.webp` for the My Trees welcome card.
- `favicon.svg` — tree-of-life mark. Used as logomark too.
- `leaf-motif.svg` — decorative pseudo-element on non-landing auth surfaces.

If new photography is needed, brief: **forest scenes, no faces, sun-through-canopy in light mode, deep shadow with green highlights in dark mode**.

## Interaction & behaviour notes

- Theme toggle persists to `localStorage`, applied via `data-theme="dark"` / `data-theme="light"` on `<html>`. Already present in the repo's `index.html` inline script — keep it.
- Auth card has a 0.6s reveal animation (opacity + 10px translate). Honor `prefers-reduced-motion`.
- Person nodes on the canvas: 1px border at rest, 1px border + 2px focus ring (`--color-accent-focus-ring`) when selected. **No** scale transform on hover.
- Sensitive nodes: dashed border + dimmed text. No solid color "warning" treatment.

## State / data

No new state requirements — all changes are presentational. The existing zustand/context/router setup in the repo stays as-is.

## Files to download

This folder contains:
- `README.md` — this document
- `README_design_system.md` — the full design system reference
- `SKILL.md` — drop into AI tooling rules
- `colors_and_type.css` — tokens
- `assets/` — 4 webp + 2 svg
- `ui_kits/traumatrees-app/` — JSX reference screens
