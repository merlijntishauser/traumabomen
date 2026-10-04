---
name: Traumatrees
description: A quiet forest for mapping what a family carries, encrypted on your own device.
colors:
  midnight-floor: "#0a1a0f"
  midnight-surface: "#0f261a"
  midnight-raised: "#163027"
  midnight-canvas: "#0d1f14"
  midnight-hover: "#1a3d2a"
  midnight-border: "#1f4d35"
  midnight-text: "#e0e8e3"
  midnight-text-secondary: "#8faa97"
  midnight-text-muted: "#7a9a84"
  forest-accent: "#2d8a5e"
  forest-accent-hover: "#24704c"
  forest-action: "#339a66"
  forest-action-hover: "#2f9362"
  linen-floor: "#f7f5f2"
  linen-surface: "#ffffff"
  linen-raised: "#f0edea"
  linen-canvas: "#f4f1ed"
  linen-hover: "#ebe7e2"
  linen-border: "#d4cec6"
  linen-text: "#2c3340"
  linen-text-secondary: "#4e5b6e"
  linen-text-muted: "#5e6b7e"
  ink-indigo: "#4f46e5"
  ink-indigo-hover: "#4338ca"
  danger-dark: "#f26b6b"
  danger-light: "#dc2626"
  danger-solid: "#b91c1c"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.2rem, 4.8vw, 3.5rem)"
    fontWeight: 350
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.7rem"
    fontWeight: 380
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  voice-h1:
    fontFamily: "Playwrite NZ Basic, Georgia, cursive"
    fontSize: "2rem"
    fontWeight: 200
    lineHeight: 1.2
  voice-h2:
    fontFamily: "Playwrite NZ Basic, Georgia, cursive"
    fontSize: "1.35rem"
    fontWeight: 300
    lineHeight: 1.35
  title:
    fontFamily: "Playwrite NZ Basic, Georgia, cursive"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: "Lato, Helvetica Neue, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Lato, Helvetica Neue, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Lato, Helvetica Neue, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  micro:
    fontFamily: "Lato, Helvetica Neue, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.03em"
  eyebrow:
    fontFamily: "Lato, Helvetica Neue, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  "0.5": "2px"
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "3.5": "14px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "15": "60px"
components:
  button-default:
    backgroundColor: "{colors.midnight-surface}"
    textColor: "{colors.midnight-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-default-hover:
    backgroundColor: "{colors.midnight-hover}"
  button-primary:
    backgroundColor: "{colors.forest-action}"
    textColor: "{colors.midnight-floor}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.forest-action-hover}"
  button-danger:
    backgroundColor: "{colors.midnight-surface}"
    textColor: "{colors.danger-dark}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  toolbar-button:
    height: "32px"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.midnight-raised}"
    textColor: "{colors.midnight-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card-solid:
    backgroundColor: "{colors.midnight-surface}"
    rounded: "{rounded.lg}"
  person-node:
    backgroundColor: "{colors.midnight-surface}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.lg}"
    width: "180px"
    height: "80px"
  side-panel:
    backgroundColor: "{colors.midnight-surface}"
    width: "400px"
---

# Design System: Traumatrees

## Overview

**Creative North Star: "The Quiet Forest"**

Every surface sits inside a forest at a quiet hour. In the dark theme it is a midnight canopy: near-black greens, a slow drift of fireflies over the hero photography, faint contour lines rising from a corner of the canvas like a map of hills. In the light theme it is morning linen: warm off-white paper with literary indigo ink, and its hero imagery leaves the forest for soft pastel paintings. The atmosphere is always there and never asks for attention. It gives depth to screens where people write about the hardest parts of their family's history, so they do not feel like a database or a clinic.

Data lives calmly inside that atmosphere. The workspace, panels, and settings are solid and legible: closed color sets for domain meaning, plain text for loading states, and the same 0.15s color fade for every state change. The expressive layer is narrow and fixed: radial accent washes with a noise dither, procedural contour-line decorations, hero imagery with no faces (forest photography in dark, soft pastel paintings in light), and the handwriting face that signs the product's voice. Everything else stays still.

Three typefaces split the work. Playwrite NZ Basic is the voice: the wordmark, taglines, person names, and in-app headings, always light. Fraunces carries structure on the public pages, set light and never bold. Lato does everything else at 15px. On iOS the same tokens, faces, and background wash are ported into SwiftUI, and they sit inside native navigation and controls instead of replacing them.

**Key Characteristics:**
- Two themes: Midnight forest (dark, default) and Morning linen (light, indigo accent).
- Atmosphere through layered radial gradients, noise texture, contour-line decorations, and ambient particles over hero imagery.
- Hero imagery differs by theme: forest photography in dark, soft pastel paintings in light.
- Solid, readable surfaces for data; glass only on auth and lock cards over photography.
- Domain colors are a closed set of tools for thinking, never decoration.
- One motion grammar: 0.15s color fades, plus two named entrances (`auth-reveal`, `slide-in-right`).

### Named Rules
**The Two Lights Rule.** Dark-theme heroes are forest photography at night; light-theme heroes are soft pastel paintings, not forest photos. The two themes do not need to show the same scene, but both stay quiet, faceless, and low contrast behind the text.

## Colors

Near-black forest greens at night and warm linen with indigo ink in the morning. Saturated color is reserved for domain meaning.

### Primary
- **Forest Green** (`forest-accent`): the brand accent in the dark theme. Used on the toolbar's 3px gradient line, the top border of person nodes, selected nodes, life bars, the radial background wash, and the scrollbar thumb on hover.
- **Grove Green** (`forest-action`): the action color in the dark theme, slightly brighter than the accent so buttons and links stay legible on near-black. Covers primary buttons, links, and the focus border and ring on inputs.
- **Ink Indigo** (`ink-indigo`): both accent and action in the light theme. Indigo was chosen because green on cream reads as generic wellness, while indigo reads as literary. In light, accent and action are the same color.

### Neutral
- **Midnight Floor / Surface / Raised / Canvas / Hover** (`midnight-*`): a five-step depth scale from the deepest page floor up to interactive hover. Surface is cards, panels, toolbars, and nodes. Raised is input fields and nested blocks. Canvas sits under the tree and the radial wash.
- **Linen Floor / Surface / Raised / Canvas / Hover** (`linen-*`): the same five-step scale in warm paper tones. Surface is pure white, and every other step is a warm grey-beige.
- **Midnight Border** and **Linen Border**: one-pixel borders on cards, panels, inputs, and default buttons.
- **Text** (`*-text`, `*-text-secondary`, `*-text-muted`): a three-step text hierarchy per theme, plus an inverse color for labels on the action color (Midnight Floor in dark, white in light).

### Semantic and domain palettes
All defined per theme in `frontend/src/styles/theme.css`. The light-theme values are darker so they hold contrast on linen.
- **Danger** (`danger-dark` / `danger-light`, plus `danger-solid` for destructive confirmation). Warning (amber), success (green), and info (sky) each come with subtle background and border tints.
- **Trauma categories:** loss, abuse, addiction, war, displacement, illness, poverty (7 colors).
- **Life event categories:** family, education, career, relocation, health, medication, other (7 colors).
- **Turning points:** cycle-breaking, protective relationship, recovery, achievement, positive change.
- **Classifications:** amber means suspected, sky blue means diagnosed.
- **Pattern rotation:** 8 colors, assigned in order to user-created patterns.
- **Relationship edges:** default (sage), partner (pink), half-sibling (purple), step (muted green, dashed), friend (orange).

### Named Rules
**The Closed Set Rule.** Domain palettes are fixed tools for the user to think with. Never add a category color without defining it for both themes. Never reuse one as decoration.

**The Two Greens Rule.** In the dark theme, accent (brand and atmosphere) and action (what the user does) are separate tokens and must not be swapped. In the light theme they are the same indigo. Reach for `--color-action` for anything clickable and `--color-accent` for anything ambient.

## Typography

**Voice Font:** Playwrite NZ Basic (with Georgia, cursive)
**Display Font:** Fraunces (with Georgia, serif), public pages only
**Body Font:** Lato (with Helvetica Neue, sans-serif)

**Character:** structure speaks in the serif, and the voice signs in the handwriting. The handwriting face makes the app feel like a family notebook. Fraunces gives the public pages literary weight without feeling corporate. Lato keeps dense data readable.

### Hierarchy
- **Display** (Fraunces 350, clamp(2.2rem, 4.8vw, 3.5rem), 1.12): hero statements on the landing, learn, tour, security, and privacy pages.
- **Headline** (Fraunces 380, 1.7rem, 1.25): section headings on public pages.
- **Voice H1** (Playwrite 200, 2rem, 1.2): in-app page headings and large voice moments.
- **Voice H2** (Playwrite 300, 1.35rem, 1.35): panel and section headings in the app.
- **Title** (Playwrite 400, 1.1rem, 1.4): compact panel headers and person names. Taglines use the same size at weight 300.
- **Body** (Lato 400, 15px, 1.5): everything else. The base size on `body`.
- **Small** (Lato 400, 13px): secondary text, set in the secondary text color.
- **Label** (Lato 700, 13px): button labels and form labels.
- **Micro** (Lato 600, 11px, 0.03em): metadata and small-button text, set in the muted text color.
- **Eyebrow** (Lato 600, 10px, 0.05em, uppercase): small kickers above headings.

### Named Rules
**The Light Hand Rule.** The handwriting face is never heavier than 400, and Fraunces is never heavier than 380. Weight never creates emphasis in a heading. Use size and spacing instead.

**The Fifteen Rule.** Body text is 15px. Not 14, not 16. Components inherit it. When a tag does not match the role it plays, use the `.t-*` role classes.

**The Sentence Case Rule.** Every label, including buttons, is in sentence case. Only eyebrows use uppercase, and only through the token.

## Layout

The app shell is a flex column at `100dvh`: header, then a scrolling main area, then a sticky footer. The workspace is a full-bleed React Flow canvas with Dagre auto-layout. Above it sits a toolbar with a 3px accent line, and detail panels slide over its right edge. Panels are 400px-wide absolute overlays with their own header row. All of them slide in from the right: person, relationship, pattern, and settings.

Spacing follows a 4px base with first-class half-steps (2, 6, 10, 14px). Panels and cards mostly use 16 to 24px padding. Toolbars use 8px vertical and 16px horizontal padding with 10px gaps.

Public pages use centered containers of 1100 to 1140px for sections, with a narrower reading column of about 520px for hero copy. Breakpoints in use are 380, 480, 560, 640, and 900px. At 640px and below, auth taglines drop out and cards go full width. Inside the app, phones currently get a banner suggesting desktop. The iOS companion covers the phone instead, using native navigation (tab bar, navigation stack, sheets) and the same tokens.

### Named Rules
**The Uniform Height Rule.** Every button in a bar shares one explicit height: 32px for toolbars, 24px for footers, and 34px for a panel header's action and close button pair. Padding alone never sets a button's height.

## Elevation & Depth

Depth comes from layered atmosphere first and shadow second. The page sits on a canvas color washed by two radial gradients of the accent (one from the top right, one from the bottom left). A fractal-noise SVG at 6% opacity stops banding, and procedural contour lines add a faint topographic drawing at 0.3 opacity in dark and 0.18 in light. Over that, surfaces lift with soft shadows. In dark, each shadow pairs a black layer with a faint green layer, so even shadows carry the forest tint. In light, the shadows are slate-tinted.

### Shadow Vocabulary
- **Small** (`--shadow-sm`): nodes and small raised controls.
- **Medium** (`--shadow-md`): popovers, menus, hovered nodes.
- **Large** (`--shadow-lg`): side panels, modals, solid cards.
- **Glass** (`--shadow-glass`): only on auth and lock cards over hero photography, paired with `backdrop-filter: blur(20px) saturate(1.2)`.

### Named Rules
**The Glass Is For Photographs Rule.** Translucent, blurred cards appear only over hero photography (auth, unlock, lock screen). Workspace, panels, settings, and every data-dense surface use solid cards: Surface background, one-pixel border, large shadow.

## Shapes

Corners are gently rounded and never pill-shaped or sharp. Small (6px) is for buttons, close controls, and chips. Medium (8px) is for inputs and menus. Large (12px) is for cards, panels, modals, and person nodes. Borders are one pixel throughout, except a person node, which has a 2px border with a 3px accent top edge. Badge shapes carry meaning: circles are trauma events, squares are life events, triangles are classifications.

### Named Rules
**The Shape Means Something Rule.** Circle, square, and triangle are reserved for the three event kinds. Never use them as generic decoration or for bullets.

## Components

Quiet and steady: labels in bold Lato at a small size, corners of 6 to 8px, and states that change color only. Nothing moves, and nothing presses in.

### Buttons
- **Shape:** gently rounded (6px).
- **Default:** Surface background, one-pixel border, primary text, Lato 700 at 13px, 9px by 16px padding. On hover, the background moves to the hover surface.
- **Primary:** action-color background and border, inverse text. On hover, the action hover color. The text color is re-asserted on hover so link-styled buttons keep a readable label.
- **Danger:** danger text and danger-tinted border on the default surface. On hover, a danger-tinted background.
- **Small variant:** 11px text. Toolbar icon and text buttons all sit at 32px.
- **Focus:** a 2px action-color focus ring. Every transition uses `var(--transition-colors)`.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Surface in the app. Translucent Floor with blur only on auth and lock surfaces.
- **Shadow Strategy:** large for solid cards, glass for auth cards (see Elevation & Depth).
- **Border:** one pixel, primary border color.
- **Internal Padding:** 20 to 24px.

### Inputs / Fields
- **Style:** Raised background, one-pixel primary border, 8px radius, 8px by 12px padding, 15px Lato.
- **Focus:** the border shifts to the action color, plus a 2px action focus ring. No outline.
- **Labels:** 13px weight 500 in the secondary text color, 4px above the field.

### Navigation
- **Workspace header:** Surface background, bottom border, a soft drop shadow, and a 3px gradient line from accent to transparent along the bottom edge. It holds the tree name in the voice face (weight 300), the view tabs as quiet text tabs (the active one on the raised surface), a muted "Encrypted on this device" note, and the account controls. Header buttons are uniform at 32px. Canvas tools never live here.
- **Workspace rail:** a 56px column on the canvas's left edge, Surface background with a right border, holding the canvas tools as 40px icon buttons in two groups split by a hairline: building (add person, auto-layout, undo), then reflecting (pattern focus, journal). Labels show as tooltips to the right; a pressed tool takes the action-subtle background. The pattern menu opens beside the rail. Below 760px the rail runs along the bottom instead.
- **Links:** action color with no underline, moving to the action hover color.
- **iOS:** native tab bar and navigation stack, tinted with the action color.

### Person Node (signature)
A 180 by 80px card on the canvas with a node-surface background, a 2px node border, a 3px accent top edge, and 12px corners. The name is set in the voice face, with years and an adoption mark below. Event badges sit along the node: colored circles, squares, and triangles by category. A selected node takes the selected color on its border.

### Side Panel (signature)
A 400px solid overlay on the right edge of the workspace with a left border and a large shadow, sliding in over 0.25s ease-out. The header row holds a voice-face title and a matched 34px action and close pair. Fields autosave on blur or change, and a quiet "saved" whisper appears in the header to confirm.

### Person Page (signature)
The person's side panel reads as a margin page in a family notebook, not a tabbed form. Top to bottom: the name in the voice face (weight 300, 1.35rem); the years; a glance sentence naming who they are to others ("Married to Hendrik. Mother of Pieter and Anna."), each name a link to that person's page; their patterns as chips with a short stroke swatch (never a circle). Then the lifeline: a year column with ages, a 2px spine, and every trauma event, life event, classification, and turning point on one line in year order, each marked with its badge shape and category color. Fifteen or more years without an entry show as a dashed stretch that names the silence and offers to add something; undated entries sit below the line. Opening an entry expands its form in place under the row; new entries come from an "Add to [name]'s life" menu. Hovering an entry rings the matching badge on the canvas and the nodes of anyone else it involves. A reflection prompt in the voice face leads to the journal, and relationships and the person's own details fold away at the bottom.

### Atmosphere (signature)
The background wash plus noise, the procedural contour lines rising from a random canvas corner (marching squares over gaussian hills, regenerated on each load), and the ambient particle layer over hero photography (fireflies in dark, warm light motes in light). The particles run on a hand-rolled 2D canvas at about 30fps, pause on hidden tabs, and switch off entirely under reduced motion. iOS recreates the wash and particles natively.

## Do's and Don'ts

### Do:
- **Do** take every color, radius, shadow, and spacing value from the tokens in `frontend/src/styles/theme.css`. It is the only place values are defined.
- **Do** use `var(--transition-colors)` (0.15s ease) for every state change. The only named entrances are `auth-reveal` and `slide-in-right` (0.25s ease-out).
- **Do** use Lucide icons, imported one at a time. Draw domain marks as 24 by 24 SVGs with a 2px stroke in Lucide's style. On iOS, use SF Symbols.
- **Do** design and check both themes for every surface. Light-theme domain colors are the darker variants.
- **Do** show loading as plain text: "Loading…".
- **Do** use forest photography for dark-theme heroes and soft pastel paintings for light-theme heroes (calm, impressionist, low contrast, sky and landscape). Never faces, in either theme.
- **Do** keep text over a light-theme painting on a linen scrim strong enough for 4.5:1 at every pixel; paintings are busier than they look.

### Don't:
- **Don't** use scale transforms, press shrink, springs, bounces, or attention-seeking motion.
- **Don't** use glassmorphism on the workspace, panels, settings, or any data-dense surface.
- **Don't** use bluish-purple gradients. The only gradients are the radial accent wash, the vignette over hero photography, and the toolbar's accent line.
- **Don't** use emoji anywhere: UI, copy, or translations.
- **Don't** build left-border callout cards as a system. The only exceptions are the prominent auth warning (3px danger border) and the auth hint block (2px accent border).
- **Don't** use drop caps, decorative quote marks, icons on rounded-square backgrounds, skeleton loaders with shimmer, or bouncy toasts.
- **Don't** bold the handwriting face or Fraunces.
- **Don't** use `--` or an em dash in user-facing text.
