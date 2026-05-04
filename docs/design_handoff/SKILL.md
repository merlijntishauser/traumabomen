---
name: traumabomen-design
description: Build designs that match the Traumabomen / Traumatrees brand — a zero-knowledge encrypted web app for mapping intergenerational trauma onto family trees. Use when designing anything tied to traumabomen.nl / traumatrees.org, or when the user references this design system.
---

# Traumabomen / Traumatrees — design skill

## What this product is

A personal reflection tool, **not therapy**, **not crisis support**. The user maps their family's intergenerational patterns onto a visual canvas; the server is zero-knowledge (encrypted client-side, server sees no content). Subject matter is heavy — abuse, addiction, war, loss. The brand answer is **calm, plainspoken, slightly fragile, never urgent**.

## Files in this project

- `colors_and_type.css` — every design token (colors, fonts, spacing, radii, shadows, motion). Import this in every new HTML file: `<link rel="stylesheet" href="colors_and_type.css">`. Never hard-code values that exist as tokens.
- `README.md` — full content + visual fundamentals reference. Read for: voice, hover/focus rules, photography character, "what we do NOT do" list.
- `assets/` — `favicon.svg`, `leaf-motif.svg`, and four hero `.webp` photographs (dark + light + unlock).
- `preview/` — small standalone cards rendered in the Design System tab. Reference for component anatomy.
- `ui_kits/traumatrees-app/` — React + Babel recreation of Auth landing, My Trees, and Workspace. Reuse `components.jsx` atoms when building new screens.

## Non-negotiables

- **Two faces only.** `--font-heading` (Playwrite NZ Basic) for headings/taglines/person names; `--font-body` (Lato) for everything else.
- **Headings are always LIGHT** (weight 200–400). Never bold the handwriting face.
- **Body is 15px.**
- **No emoji. Ever.** Subject matter is too sensitive.
- **Sentence case for every label**, including buttons. *"Add person"*, not *"Add Person"*.
- **Lucide icons only** for stock UI (`Heart`, `Lock`, `Sun`, `Moon`, `Eye`, `EyeOff`, `MessageSquare`). For domain marks not in Lucide, draw a 24×24, 2px-stroke SVG matching Lucide's grammar.
- **One accent: forest green** (`--color-accent`). Domain colors (trauma categories, life events, turning points, pattern rotation) are tools for the user to think with, not decoration.
- **No press shrink, no scale transforms, no springs.** All transitions use `var(--transition-colors)` (0.15s ease).
- **No glassmorphism on data-dense surfaces.** Glass only on auth/lock cards over hero photography.

## Voice cheatsheet

- Pronouns: *"you"* and *"your"*. The system uses *"we"* sparingly, only for technical guarantees.
- Lead with reassurance, follow with proof. Glance + depth pattern.
- Honest about hard truths: *"If you lose your passphrase, your data is unrecoverable. This is by design."* Never softened.
- Reflection prompts are open questions, never imperatives. *"What was never spoken about, but everyone knew?"* — not *"Try writing about…"*.
- Bilingual EN/NL — Dutch voice equally restrained.

## When designing a new screen

1. Open `README.md` and skim the relevant Visual Foundations section.
2. Pick the right card pattern: **glass card** for auth/lock surfaces over photography, **solid card** (`var(--color-bg-secondary)` + 1px border + `--shadow-lg`) for everything inside the app.
3. Use atoms from `ui_kits/traumatrees-app/components.jsx` — load it as `<script type="text/babel" src="…/components.jsx">` and the atoms attach to `window`.
4. Match copy tone to the existing translations (see README microcopy examples).
5. Photography only: forest scenes, no faces, dark + light variants. Use placeholders if needed and ask the user for the real material.
