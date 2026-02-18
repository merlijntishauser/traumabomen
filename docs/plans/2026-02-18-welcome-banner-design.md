# Welcome Banner and Feedback Visibility

## Problem

The feedback button is buried as an icon-only button among several other icons in the app footer. Early-stage users are unlikely to notice it, reducing the chance of receiving valuable bug reports and feature requests.

## Solution

Two changes that work together:

1. **Welcome card** on the tree list page -- a warm, inviting banner that greets users, guides them to create their first tree, and prominently offers a way to send feedback.
2. **Upgraded footer feedback button** -- icon + text label with accent styling so it remains visible after the welcome card is dismissed.

## Welcome Card

### Placement

Top of the tree list content area (`TreeListPage.tsx`), above the tree list or empty state. Visible immediately after login/unlock.

### Copy

Heading: `welcome.title` -- "Welcome to Traumatrees" / "Welkom bij Traumabomen"

Body: `welcome.body` -- "This is an early version of the app. Start by creating your first tree -- and if anything feels off or you have ideas, we'd genuinely love to hear from you."

Buttons:
- `welcome.sendMessage` -- "Send us a message" (opens FeedbackModal)
- `welcome.createTree` -- "Create your first tree" (triggers existing create flow)

Dismiss: small X button in top-right corner.

### Visual Treatment

- Background: `--color-bg-secondary`
- Left border: 3px solid `--color-accent` (green stripe)
- Heading: `--font-heading` (Playwrite NZ Basic), weight 300
- Body: standard `--font-body` (Lato)
- Border radius: `--radius-lg`
- Max width matches tree list content
- Subtle, no shadows -- fits the layered forest aesthetic

### Background Images

Two theme-aware Unsplash photos displayed behind a semi-transparent overlay.

**Dark theme:** Bench in a green park (Unsplash `0YAIK1HaC-Q`) -- lush green foliage with a solitary bench. Dark green overlay preserves the moody forest aesthetic.

**Light theme:** Sunlit foggy forest (Unsplash `U-eRC8Q5iEY`) -- golden morning light streaming through misty autumn trees. Warm white overlay keeps the bright, open feel.

**Implementation:**
- Two `<img>` elements inside the card, absolute-positioned with `object-fit: cover`
- CSS opacity swap between themes (same pattern as AuthHero)
- `::before` pseudo-element overlay with left-to-right gradient: heavier on the text side (~0.75), lighter on the right (~0.55) so the image peeks through
- Dark overlay: `rgba(10, 26, 15, 0.75)` to `rgba(10, 26, 15, 0.55)`
- Light overlay: `rgba(255, 255, 255, 0.75)` to `rgba(255, 255, 255, 0.55)`
- Text shadow for legibility: dark theme `0 1px 3px rgba(0,0,0,0.3)`, light theme `0 1px 2px rgba(255,255,255,0.5)`
- All card content at z-index 2 above the overlay

**Files:** `frontend/public/images/welcome-dark.jpg`, `frontend/public/images/welcome-light.jpg` (resized to ~1200px wide)

### Dismiss Logic

The card remains visible until both conditions are met:
1. The user has at least one tree
2. The user has explicitly dismissed the card (clicked X)

Dismissal state stored in `localStorage` key `traumabomen_welcome_dismissed`. The card reappears if the user deletes all their trees (condition 1 no longer met), since they're effectively starting over.

### "Create your first tree" button

Only shown when the user has zero trees. When trees exist, the card simplifies to just the welcome message and feedback button.

## Footer Feedback Button Upgrade

### Current

Icon-only `MessageSquare` button, same muted styling as all other footer actions.

### New

- Add text label "Feedback" / "Feedback" (same in both languages) next to the icon
- Apply accent border: `border-color: rgba(45, 138, 94, 0.3)`
- Apply accent text color: `--color-accent`
- Hover: `background: --color-accent-subtle`
- This mirrors the `.admin-waitlist-btn--approve` pattern

## Translation Keys

### English
- `welcome.title`: "Welcome to Traumatrees"
- `welcome.body`: "This is an early version of the app. Start by creating your first tree -- and if anything feels off or you have ideas, we'd genuinely love to hear from you."
- `welcome.sendMessage`: "Send us a message"
- `welcome.createTree`: "Create your first tree"

### Dutch
- `welcome.title`: "Welkom bij Traumabomen"
- `welcome.body`: "Dit is een vroege versie van de app. Begin met het aanmaken van je eerste boom -- en als iets niet lekker werkt of je hebt ideeen, horen we heel graag van je."
- `welcome.sendMessage`: "Stuur ons een bericht"
- `welcome.createTree`: "Maak je eerste boom"

## Files Changed

- `frontend/src/pages/TreeListPage.tsx` -- add welcome card component
- `frontend/src/styles/tree-list.css` -- welcome card styles
- `frontend/src/components/AppFooter.tsx` -- add text label to feedback button
- `frontend/src/styles/footer.css` -- accent styling for feedback button
- `frontend/src/locales/en/translation.json` -- welcome keys
- `frontend/src/locales/nl/translation.json` -- welcome keys

## Tests

- `TreeListPage` is not currently tested; add a test file covering:
  - Welcome card visible when no trees and not dismissed
  - Welcome card visible when trees exist but not dismissed
  - Welcome card hidden after dismiss + has trees
  - Welcome card reappears when trees are empty again
  - "Send us a message" opens feedback modal
  - "Create your first tree" button only shown when no trees
- `AppFooter.test.tsx` -- verify feedback button has text label
