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
  midnight-stripe-lived: "#1b3428"
  midnight-stripe-grid: "rgba(224, 232, 227, 0.06)"
  midnight-stripe-read: "#ffffff"
  midnight-stripe-read-wash: "rgba(255, 255, 255, 0.09)"
  midnight-stripe-read-ink: "#0a1a0f"
  linen-stripe-lived: "#e3ddd3"
  linen-stripe-grid: "rgba(44, 51, 64, 0.07)"
  linen-stripe-read: "#14110f"
  linen-stripe-read-wash: "rgba(20, 17, 15, 0.07)"
  linen-stripe-read-ink: "#ffffff"
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
- One motion grammar: 0.15s color fades, plus two named entrances (`auth-reveal`, `slide-in-right`) and one authored view motion (the timeline's Years/Age slide).

### Named Rules
**The Two Lights Rule.** Dark-theme heroes are forest photography at night; light-theme heroes are soft pastel paintings, not forest photos. The two themes do not need to show the same scene, but both stay quiet, faceless, and low contrast behind the text.

## Colors

Near-black forest greens at night and warm linen with indigo ink in the morning. Saturated color is reserved for domain meaning.

### Primary
- **Forest Green** (`forest-accent`): the brand accent in the dark theme. Used on the toolbar's 3px gradient line, the top border of person nodes, selected nodes, the radial background wash, and the scrollbar thumb on hover.
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

- **Family stripes** (`*-stripe-*`, timeline only): **Lived** is the band of years a person lived, a tone one step off the floor (a deep green in dark, warm sand in light). **Grid** is the faint decade rule and the hover column. **Read** is the one reserved ink for the year being read: white in dark, near-black in light, with a translucent **read wash** filling the read column and **read ink** (the inverse) for the year flag's text.

### Named Rules
**The Reading Ink Rule.** The stripe read ink marks the year being read (the column outline and the flag on the ruler) and nothing else. Never use it for a category, a selection, a button, or emphasis anywhere else.

**The Form Not Hue Rule.** Uncertainty is drawn as form, never as a second color: approximate dates and suspected classifications are hatched at 45 degrees in their own category color over the lived band. Don't invent a lighter tint or a new hue to say "maybe".

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

Depth comes from layered atmosphere first and shadow second. The page sits on a canvas color washed by two radial gradients of the accent (one from the top right, one from the bottom left), under a soft edge vignette (`--color-vignette`: black in dark, a faint warm shade in light) that deepens the corners and leaves the centre open. A fractal-noise SVG at 6% opacity stops banding. Procedural contour lines draw a topographic map over that at `--decoration-opacity` 0.42 in dark and 0.4 in light, inked in `--color-contour` (the forest green lifted slightly in dark; indigo softened toward slate in light, so it reads as pencil, not blue), with a glow under each summit (`--color-contour-glow`: the accent in dark, warm sand in light, never a purple wash). Over that, surfaces lift with soft shadows. In dark, each shadow pairs a black layer with a faint green layer, so even shadows carry the forest tint. In light, the shadows are slate-tinted.

### Shadow Vocabulary
- **Small** (`--shadow-sm`): nodes and small raised controls.
- **Medium** (`--shadow-md`): popovers, menus, hovered nodes.
- **Large** (`--shadow-lg`): side panels, modals, solid cards.
- **Glass** (`--shadow-glass`): only on auth and lock cards over hero photography, paired with `backdrop-filter: blur(20px) saturate(1.2)`.

### Named Rules
**The Glass Is For Photographs Rule.** Translucent, blurred cards appear only over hero photography (auth, unlock, lock screen). Workspace, panels, settings, and every data-dense surface use solid cards: Surface background, one-pixel border, large shadow.

## Shapes

Corners are gently rounded and never pill-shaped or sharp. Small (6px) is for buttons, close controls, and chips. Medium (8px) is for inputs and menus. Large (12px) is for cards, panels, modals, and person nodes. Borders are one pixel throughout, except a person node, which has a 2px border with a 3px accent top edge. Badge shapes carry meaning: circles are trauma events, squares are life events, triangles are classifications, stars are turning points. Inside the timeline chart, corners shrink to fit the marks: 3px on a life band, 4px on the year flag, 1.5px on life-event squares.

### Named Rules
**The Shape Means Something Rule.** Circle, square, triangle, and star are reserved for trauma events, life events, classifications, and turning points. Never use them as generic decoration or for bullets.

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

### Tree List Threshold (signature)
The page after unlock opens on your family, not on a file list. The most recently tended tree fills a band: on the left, a read-only silhouette of its actual canvas layout (miniature nodes with the accent top edge, names in the voice face, partner lines in the partner colour, parent lines elbowed from the couple, dashed for chosen parents and former partners) on the canvas surface with the contour lines behind it; the whole preview opens the tree. On the right, the tree name in the voice face (weight 200, 2rem), the meta line, a hairline, one open question in the voice face, then Open tree as the primary action and Write about it as a quiet link. An empty tree shows one dashed place reading "Start with yourself". Other trees follow as rows under "Other trees", and starting a new tree or exploring the fictional family stay quiet below. Only the latest tree is decrypted for the preview; the rest show plaintext counts. Under 860px the band stacks, preview first.

### Journal Desk (signature)
The journal page is a writing desk, not a feed. On the left, a solid sheet (Surface, large shadow, 12px corners) opens on one open question in the voice face (weight 200, 1.6rem) with "Answer this question" and "Another question". Below a hairline sits a quiet Write/Preview text toggle and a borderless writing surface: 15px Lato at 1.8 line height, 68ch wide. Answering a question puts it into the entry as a markdown quote, so rereading shows the question apart from the answer. On the right, a sticky margin of earlier entries, newest first: the date in the voice face, a three-line plain-text excerpt, and up to three linked chips. The open entry is raised (Surface, border, small shadow). Choosing one opens it in the sheet to reread, with Edit and "Write a new entry". The contour lines replace the old lined paper. Under 900px the margin drops below the sheet.

### Family Stripes (signature)
The timeline reads a family like climate stripes, from across a room. Three columns: names by generation on the left (a muted generation label, each name in the voice face at 15px weight 400, years below in 13px tabular figures; the column stays put when the field scrolls sideways), the stripe field in the centre, and a 340px reading pane on the right (300px under 1080px; under 860px it drops below the chart). The page sits on the plain floor color with no contour lines behind it.

- **The band:** each life is one band of whole-year cells, 28px tall with 3px corners, filled with the lived tone. Cell width fits the span to the available width (never under 6px). A decade ruler of 13px muted figures runs on top, with faint grid lines down the field and a dashed muted line at today in Years mode; a hairline in the border color separates generations.
- **Marks:** trauma fills the cells of its years in its category color. When several traumas share a year they stack as equal horizontal slices, separated by a 3px gap in the floor color. Life events are 9px squares on the band's lower edge, outlined in the floor color. Classifications are a 4px rule along the foot of the band, diagnosed solid and suspected hatched. Turning points are a small star above the band. Approximate dates are hatched (see The Form Not Hue Rule). Marks never carry text; every label lives in the reading pane.
- **The year being read:** one column outlined in the read ink (1.5px) over the read wash, with a flag on the ruler showing the year in bold 13px read-ink text. Hovering the field shades the column under the pointer in the grid tone. Clicking a column, the arrow keys (Shift moves ten), or the pane's 32px previous and next buttons move the reading; the field is a range input underneath, with a 2px action-color focus outline.
- **Years and Age:** a two-button switch (8px container on the surface, 28px buttons in 13px bold Lato, the pressed one on the action color) above the names. Switching slides and rescales every life into its new place over 0.56s on `cubic-bezier(0.16, 1, 0.3, 1)`, then redraws it crisply. This is the view's one authored motion; under reduced motion it does not play.
- **Reading pane:** Surface background with a left border. The year (or age, with a small "Age" unit) in Lato 300 at 2.5rem with tabular figures, a 13px muted hint, then one block per person alive that year, divided by hairlines: names in the voice face (in Years mode, people whose year held exactly the same entries share one block, and a shared surname is said once), their age on the right, and one line per entry with its badge mark, title, and a muted "category, date" (approximate dates say "about"). Everyone with nothing recorded, not yet born, or already gone is folded into one muted 13px line. The pane closes on one open question in the voice face (weight 300).
- **Highlighting:** hovering or focusing an entry lights every entry with the same title; hovering a key item lights everything it describes, and clicking a key item pins it (underlined, `aria-pressed`). Unlit marks fade to 14% and unlit rows, blocks, and key items to 32%, over 0.15s.
- **The key:** below the chart, aligned with the field, three groups that wrap as units (trauma with the approximate swatch, life events, then marks: diagnosed, suspected, turning point), each led by a muted label. Only categories present in the tree appear.
- **Opening:** names in the names column and the pane open the person page; an entry in the pane opens the person page at that entry.
- **Dates read like people write them:** besides calendar years, an entry can be dated by age ("at 12"), a stage of life ("as a child", "in her twenties"), a decade in words ("the sixties") or a two-digit year ("'85"). Ages and stages land on each person's own years from their birth year and are always hatched, because they are approximate. In the pane they read as ages ("ages 0 to 12", "from age 65"), not as the years they land on.
- **Date preview in the forms:** under the date field of the trauma, life event and turning point forms, one muted line in the inspector-hint style says how the timeline reads what is typed ("Reads as 1944, when Harold was 12."; "Reads as ages 0 to 12: 1960 to 1972 for Robert."), or that it has no year to place yet and what to try instead.
- **Entries without a year:** a date with no year to read (free text such as "as a child") cannot be placed, and is never dropped silently. Under the person's years, a small calendar-off icon with a count opens their page at the first such entry. Under the key, one muted line counts them all. In the pane, "Nothing recorded" names only people with no undated entries; anyone else gets their own line saying there may be more than the stripes show.
- **Phones:** under 560px the names column narrows to 124px and shows short names, and the field scrolls sideways while keeping the read column in view.

### Atmosphere (signature)
The background wash with its vignette and noise; the procedural contour map (marching squares over three gaussian hills: a main peak beyond a random corner, a knoll inward from it, a low far hill toward the opposite corner, plus gentle ripples; regenerated on each load) with heavier index contours every fifth level, levels that stop short of each summit, rings smaller than a node dropped so nothing reads as a target, and a soft summit glow. It sits behind the canvas, tree list, journal, patterns and insights, and deliberately not behind the timeline, whose stripes sit on the plain floor color so the cells read flat; pages that scroll inside their own container use the `.page-atmosphere` frame so the map stays put; and the ambient particle layer over hero photography (fireflies in dark, warm light motes in light). The particles run on a hand-rolled 2D canvas at about 30fps, pause on hidden tabs, and switch off entirely under reduced motion. iOS recreates the wash and particles natively.

## Do's and Don'ts

### Do:
- **Do** take every color, radius, shadow, and spacing value from the tokens in `frontend/src/styles/theme.css`. It is the only place values are defined.
- **Do** use `var(--transition-colors)` (0.15s ease) for every state change. The only named entrances are `auth-reveal` and `slide-in-right` (0.25s ease-out); the only other authored motion is the timeline's Years/Age slide, and it is off under reduced motion.
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
