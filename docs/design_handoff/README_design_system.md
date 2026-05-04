# Traumabomen / Traumatrees — Design System

> A zero-knowledge encrypted web app for mapping intergenerational trauma onto visual family trees. A **personal reflection tool**, not therapy and not crisis support.

Live at [traumatrees.org](https://traumatrees.org) (EN) and [traumabomen.nl](https://www.traumabomen.nl) (NL).

---

## Sources

This system was reverse-engineered from the public application source. None of these are pre-loaded — open them yourself if you have access.

| Resource | Link / Path |
|---|---|
| Repo | https://github.com/merlijntishauser/traumabomen |
| Theme tokens | `frontend/src/styles/theme.css` |
| Component CSS | `frontend/src/styles/{auth,footer,tree-list,admin,feedback,privacy}.css` |
| Component CSS (co-located) | `frontend/src/components/*.css` (`AuthModal`, `LockScreen`, `PatternView`, …) |
| Translations (en/nl) | `frontend/public/locales/{en,nl}/translation.json` |
| Images | `frontend/public/images/*.webp` |
| Icon set | `lucide-react` v1.8.0 (npm) |
| Stack | Vite + React 19 + TypeScript + React Flow + D3 + i18next |

The app has **two surfaces**: a marketing-style landing/auth page (full-bleed forest hero + glass card) and an authenticated **workspace** (canvas, timeline, journal, insights, admin).

---

## Index

```
Traumabomen Design System/
├── README.md                  ← this file
├── SKILL.md                   ← agent skill manifest
├── colors_and_type.css        ← all design tokens (CSS vars) + type roles
├── assets/                    ← logos, hero photography, leaf motif
├── preview/                   ← cards rendered in the Design System tab
└── ui_kits/
    └── traumatrees-app/       ← React JSX recreation of the web app
        ├── README.md
        ├── index.html         ← interactive click-thru demo (open this)
        ├── components.jsx     ← shared atoms + icon set (attached to window)
        ├── AuthLanding.jsx    ← landing page with glass card over forest hero
        ├── TreeList.jsx       ← "My Trees" page with welcome card
        └── Workspace.jsx      ← tree workspace: toolbar + canvas + side panel
```

---

## What this system covers

- **Brand voice & content fundamentals** — how to write copy, what tone to hit
- **Visual foundations** — color, type, surfaces, shadows, motion, the forest motif
- **Iconography** — Lucide React + a few custom SVG marks
- **One UI kit** for the only product surface, the Traumatrees web app
- **Token reference** — every CSS var in `colors_and_type.css`

---

## CONTENT FUNDAMENTALS

**Voice: gentle, plainspoken, declarative.** Sentences are short. The product is described as a *"personal reflection tool"* — never as therapy, treatment, or a clinical tool. The disclaimer in the footer reads simply *"Personal reflection tool, not therapy"*. There is always a quiet hand on the user's shoulder; never urgency, never marketing energy.

**Pronouns: "you" and "your", never "we tell you" or "us".** When the system speaks about itself it uses *"we"* sparingly and only to describe technical guarantees (`"We can never read your names, dates, relationships, or events."`). The user owns the data and the story; the product is a tool they use.

**Casing: Sentence case everywhere.** Page titles, button labels, nav items — all sentence case. *"Create account"*, *"My Trees"* (only proper nouns capitalize), *"Add person"*, *"Reset password"*. Never SHOUTY-CAPS, never Title Case For Buttons.

**Direct address, plain language.** Onboarding copy reads like a friend talking:

- *"You set the pace. Pause or stop whenever you want."*
- *"Not sure where to start? Create a demo tree with fictional data to explore all features first."*
- *"Your data is encrypted before it leaves your device. The server sees no content."*

**Two-tier explanations: glance + depth.** The privacy policy is structured as *"At a glance"* and *"In depth"*. Glance copy is one short paragraph in everyday English. Depth copy adds the technical detail (Argon2id, AES-256-GCM, …). Pattern: lead with reassurance, follow with proof.

**Honest about hard truths.** The biggest design choice is also the biggest content choice: *"If you lose your passphrase, your data is unrecoverable. This is by design."* That sentence is not softened, hidden, or apologized for. Promotional copy is allowed to say *"your story belongs to no one but you"* — but only *after* the warning has been delivered first.

**Never dramatic, never alarmist.** Even on a screen called *"What this may bring up"*, the language is calm: *"Exploring family patterns can be emotionally charged."* Not *"This may trigger you."* Not *"Warning."*

**Bilingual EN/NL.** All copy is mirrored in `translation.json`. The Dutch voice is equally restrained — *"Wij zijn Mind"* (the NL crisis resource) is referenced in plain language, not branded.

**Emoji: never.** Not in copy, not in UI, not in the workspace. Sensitive subject matter, clinical-warm tone, no emoji.

**No exclamation marks** in product copy. (One exception: *"You're approved!"* in the waitlist banner, which is genuine good news.)

**Reflection prompts are open questions, not advice.** *"What patterns do you notice repeating?"*, *"If you could ask one ancestor a question, who and what would it be?"*, *"What was never spoken about, but everyone knew?"* Never *"Try writing about…"*. Never imperative.

**Microcopy examples to study:**

- Empty state: *"Your tree is empty"* + *"Add your first family member to start building your tree."* (not *"Get started by adding people!"*)
- Destructive confirm: *"This action is permanent. Your account and all your data will be permanently deleted and cannot be restored."* + a `Type DELETE to confirm` field.
- Error: *"Wrong passphrase"*, *"This reset link is invalid or has expired."* — no apology, no smiley, no follow-up question.

---

## VISUAL FOUNDATIONS

### Mood

A walk in a misty forest at dusk. Dark forest green by default; warm cream as the alternate light theme. Photography is soft, atmospheric, slightly desaturated, with depth-of-field. Never bright, never saturated, never "tech-y."

### Color

**Two themes ship today** — `dark` (default, `:root`) and `light` (`[data-theme="light"]`). The HTML preloads the saved theme before first paint to avoid flashing. A third `watercolor` theme is hinted at in the boot script and reserved for later.

The dark palette is built around `#0a1a0f` (near-black forest floor) → `#0f261a` (canvas) → `#1f4d35` (border). The accent is a single forest green `#2d8a5e` used for CTAs, focus rings, links, and selection. The light palette swaps to `#f7f5f2` cream → `#34a066` accent, with text in slate `#2c3340`.

**Semantic color is broad.** Trauma categories, life-event categories, classification status, turning points, and pattern-overlay annotations each get their own hue. These colors are tools for the user to think with — they are not decorative. See `colors_and_type.css` for the full list. Pattern colors rotate through 8 hues so multiple user-created annotations stay distinguishable.

### Typography

**Two faces, intentional contrast:**

- **Playwrite NZ Basic** for headings — a handwriting face, weights 100–400. Always used at light weights (200–400). Loose, human, slightly fragile. It says: *"this is your story, in your handwriting."*
- **Lato** for everything else — a humanist sans, weights 300/400/700/900 + italic 400. Body sits at **15px / line-height 1.5**.

**Headings are LIGHT.** `h1` uses weight 200 at ~2rem; `h2` weight 300; `h3` weight 400. The handwriting face needs that air — never bold a heading.

**Font fallback:** Lato → Helvetica Neue → sans-serif. Playwrite NZ Basic → Georgia → cursive (the Georgia fallback is intentional — a serif still reads as "personal" if the webfont fails). Both are loaded from Google Fonts in `index.html`.

### Spacing

A 4-px scale (`--space-1` = 4px) up to `--space-15` = 60px. Dot/half steps are first-class (`--space-0.5`, `--space-1.5`, `--space-2.5`, `--space-3.5`). Gutters between section-level blocks are `--space-6` (24px); cards pad with `--space-6` to `--space-8`.

### Backgrounds

- **Full-bleed photography** on the auth landing and unlock pages — forest paths, tree canopies. Each image ships in dark + light variants and dark + light WebP + JPEG. A radial vignette (`rgba(10, 26, 15, 0.15) → 0.6`) tames the brightness.
- **Subtle radial gradient** on workspace canvases (`bg-gradient` class) — accent-tinted ellipse from bottom-left, fading to canvas color, dithered with an SVG noise filter at 6% opacity to prevent banding.
- **Decorative SVG contour lines** layered on auth/landing surfaces at 16% opacity (`branch-decoration` class).
- **Generation banding** in the timeline alternates `rgba(255,255,255,0.02)` ↔ transparent — barely visible, just enough rhythm.

### Cards & surfaces

Two card styles, used for different jobs:

1. **Glass card** (auth landing, lock screen) — `rgba(10, 26, 15, 0.78)` background, `backdrop-filter: blur(20px) saturate(1.2)`, 1px translucent border, `0 8px 40px rgba(0,0,0,0.35)` shadow. Reveals on scroll-y with a 0.6s `auth-reveal` animation.
2. **Solid card** (workspace, settings, panels) — `var(--color-bg-secondary)`, 1px primary border, `--shadow-lg`, no blur.

Corner radii are small: `--radius-sm` = 6px (buttons, inputs), `--radius-md` = 8px (form groups), `--radius-lg` = 12px (cards). **No pills, no hard squares.**

### Borders & shadows

Borders are mostly 1px in `--color-border-primary`. The auth field-group uses a 1px border with a sub-tint background (`rgba(255,255,255,0.03)` dark, `rgba(0,0,0,0.02)` light) to chunk related fields. Shadows have a subtle green tint — `0 8px 24px rgba(0,0,0,0.4), 0 4px 16px rgba(45,138,94,0.1)` — so even the lift feels like the forest.

Inset glow is rare. The `auth-warning--prominent` block uses a 3px left border in `--color-danger` against a subtle red wash; the `auth-hint-block` uses a 2px left border in `--color-accent`. Otherwise there are no left-border-only "callout" cards.

### Motion

**Restrained, mostly fades.** All transitions use the shared `--transition-colors` token: `color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease`. No springs, no bouncing. Two named animations exist:

- `auth-reveal` — 0.6s ease-out, opacity 0→1 + translateY(10px→0). Used on the welcome card and the auth card; the card has a 0.15s delay so they cascade.
- `slide-in-right` — 0.25s ease-out, panel overlay slides in from right edge.

Theme switches transition with a 0.4s cross-fade on the hero images and a 0.4s background transition on the body. Pattern overlays on the timeline pulse on hover at 0.15s.

`@media (prefers-reduced-motion: reduce)` disables the reveal animations.

### Hover & press

- **Buttons hover**: background shifts to a warmer tier (`--color-bg-hover`) or to the accent's hover variant (`--color-accent-hover`, ~10% darker). Border may shift up one tier.
- **Links hover**: color from `--color-accent` to `--color-accent-hover`.
- **Tree-list-item hover**: row tinted with `--color-bg-hover`, link text becomes accent green.
- **No press shrink, no scale transform.** The interface is calm.
- **Focus**: border becomes `--color-border-focus` and a 2px focus ring in `--color-accent-focus-ring` outside it.

### Transparency & blur

Used in three places only:

1. **Glass auth/lock cards** — `backdrop-filter: blur(20px) saturate(1.2)` over the hero photography.
2. **Mental-health banner** — sits over the app, a thin warm strip.
3. **Modal overlays** — `--color-bg-overlay` (`rgba(0,0,0,0.55)`).

All blur is wrapped in `@supports (backdrop-filter)` with a solid fallback. Never use blur on workspace surfaces — readability of dense data wins.

### Imagery character

Photography is **moody, cool, foggy forest scenes**. Welcome card images are slightly warmer (sun through trees). Faces never appear. The unlock hero is darker and tighter — it's the locked door. Light-theme variants of every hero are **brighter, warmer, less foggy** but still photographic, still respectful, still no people.

### Layout rules

- **Two-pane auth** at ≥900px: photo on the left (`flex: 1`), form pane on the right (`width: 480px`). Below 900px stacks: photo at 40vh, form below.
- **Centered content column** on simple pages: `max-width: 600px`, `padding: var(--space-8) var(--space-6)`, `margin: 0 auto`.
- **Workspace** is full-bleed flex with a fixed footer at the bottom (`height: 100dvh`).
- **Footer is always pinned** at the bottom, 44px tall + a 24px colophon row.
- **Mental-health banner** is fixed at the top when present.

### Animation easing

Default easing is `ease` or `ease-out`. There is no custom cubic-bezier curve in the system; every motion is gentle and predictable.

### What we do NOT do

- No glassmorphism on data-dense surfaces
- No bluish-purple gradients (the only gradient is the radial accent wash + radial vignette)
- No emoji cards or emoji icons
- No left-border-only "callout" cards as a system — only specific warnings
- No drop caps, no decorative quote marks
- No icon-with-rounded-square-background pattern
- No skeleton loaders with shimmer (loading is shown as plain *"Loading…"*)
- No toast notifications with bouncy entrances

---

## ICONOGRAPHY

**Primary icon set: `lucide-react` v1.8.0** (npm). Icons appear at small sizes (12, 14, 16, 18 px) and inherit `currentColor`. The brand uses a **specific, small set of Lucide marks** consistently:

- `Heart` — safety/disclaimer footer (12px, filled with `currentColor`, used in pink `--color-edge-partner`)
- `Lock` — lock screen, auto-lock action, encryption indicators (14–16px)
- `MessageSquare` — feedback button (14px)
- `Sun` / `Moon` — theme toggle, swapped per current theme (16px)
- `Eye` / `EyeOff` — password/passphrase show/hide

Icons are imported individually (`import { Heart, Lock } from "lucide-react"`) — never the whole pack. Stroke width is the Lucide default (2px); `Heart` is the only icon used filled (`fill="currentColor" strokeWidth={0}`).

In this design system, link to Lucide via CDN:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

Or as inline SVG when using as React components in `.jsx` UI-kit files. Treat lucide as the source of truth — don't draw your own glyph variants of these.

**Custom SVG marks (in `assets/`):**

- `favicon.svg` — small forest-green tree-of-life favicon
- `leaf-motif.svg` — decorative leaf used as a pseudo-element on auth pages (currently `display: none` in the landing variant, kept for non-landing auth pages)

**Unicode characters used as UI:**

- `&times;` (×) for close buttons in the mental-health banner
- `&middot;` / dot separators in the footer colophon are styled `<span>` dots, not unicode

**No emoji, ever.** This is a non-negotiable brand rule given the subject matter.

**Photography (in `assets/`):**

- `hero-dark.webp` / `hero-light.webp` — primary auth landing hero (forest path, fog)
- `hero-unlock-dark.webp` — darker, tighter forest crop for the unlock screen
- `welcome-dark.webp` / `welcome-light.webp` — welcome card backdrop on `/trees`

When introducing a new icon: pick from Lucide first. If Lucide doesn't have it, draw a 2-px stroke, 24×24 viewBox SVG that matches the Lucide grammar — never copy-paste from a different icon family.

---

## Caveats / known gaps

- **`watercolor` theme** is referenced in the boot script in `index.html` but its tokens were not found in `theme.css`. Treat it as future-work; the system today is dark + light only.
- **No design-system documentation file** exists in the source repo — these guidelines were inferred from CSS, components, and copy. Anything marked "we don't do X" is a pattern observed by absence, not a written rule.
- **Workspace-internal screens** (Canvas, Timeline, Insights, Journal, Admin) are dense and product-specific. The UI kit recreates the layout shell (header, side panel, canvas pane) but uses placeholder content for the React Flow tree and D3 timeline rather than a real working graph engine.
