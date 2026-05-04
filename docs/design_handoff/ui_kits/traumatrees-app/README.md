# Traumatrees · UI kit

A React + Babel-in-the-browser recreation of the three main screens:

| Screen | File | What it covers |
|---|---|---|
| Auth landing | `AuthLanding.jsx` | Full-bleed forest hero + glass card, theme toggle, the irreversible-passphrase warning |
| My Trees | `TreeList.jsx` | Authenticated nav, welcome card with hero crop, tree list rows |
| Workspace | `Workspace.jsx` | Toolbar (segmented view switcher), React-Flow-style canvas, person side panel, safety footer |

**Atoms** live in `components.jsx` — `Button`, `IconButton`, `Field`, `Input`, `Textarea`, `FieldGroup`, `Checkbox`, `Badge`, `Eyebrow`, `Card`, `Divider`, `Logo`, `Logomark`, plus a Lucide-grammar icon family (`IconLock`, `IconHeart`, `IconLeaf`, `IconTreeView`, `IconTimeline`, `IconPatterns`, …).

## Run

Just open `index.html` — everything loads from CDN. The little floating switcher at the top toggles between the three screens; the choice persists across reloads.

## Tokens

Every value comes from `../../colors_and_type.css`. **Don't hard-code colors, font names, radii, or shadow recipes.** Use the CSS vars (`var(--color-accent)`, `var(--font-heading)`, `var(--radius-md)`, `var(--shadow-lg)`).

## Conventions used here

- **No `const styles = {…}` collisions** — atoms inject one shared stylesheet (`#__tt_kit_css`) and screens use scoped class prefixes (`al__`, `tl__`, `ws__`).
- **All components export to `window`** at the end of each file so other Babel scripts can use them.
- **Headings always light weight** (200–400). Never bold a heading in the handwriting face.
- **Photography placeholders** — the welcome card and auth hero point to real `assets/*.webp` files copied from the repo. If you swap them, keep dark and light variants in sync.

## Caveats

- The "canvas" is hand-laid SVG nodes with absolute positioning, not a real React Flow instance.
- The timeline view inside the workspace toolbar switches state but does not yet render the timeline — the canvas always shows. Patterns view ditto. These are the natural places to extend.
- Form fields are uncontrolled placeholders; passphrase show/hide and the agree checkbox are wired up but the submit button does nothing.
