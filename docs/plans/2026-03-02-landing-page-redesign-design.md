# Landing Page Redesign

## Goal

Make the login and register pages more inviting by leading with a welcome message and value proposition instead of the auth form. Explain the two-credential system (password + passphrase) inline on the register page.

## Current State

The login page has a split layout: hero image left, form panel right. On desktop the form card is ordered first (via CSS `order`) and the explainer text sits below it. On mobile the hero banner is at the top, then the explainer, then the form. The register page has no explainer at all.

First-time visitors see a login form as the dominant element. There is no quick explanation of what the tool does, and the register page offers no guidance on why two separate credentials are needed.

## Design

### Welcome-first layout

Both login and register pages show welcome content above the auth form. The content panel (right side on desktop, below hero on mobile) flows as:

1. App title in the heading font
2. Tagline as subtitle
3. About paragraph explaining what the tool is
4. Three compact feature highlights (dotted list, no icons or cards)
5. Privacy note with "Your data stays yours" heading and condensed text
6. Privacy policy link
7. The auth form (login or register), visually separated by spacing and a subtle border

The CSS `order` swap that currently puts the card before the explainer on desktop is removed. Natural DOM order applies: welcome content first, form second.

### Shared AuthWelcome component

Extract the welcome content into an `AuthWelcome` component used by both LoginPage and RegisterPage. It renders the tagline, about text, feature highlights, privacy section, and policy link. No props; reads everything from `useTranslation()`.

### Feature highlights

Three short lines between the about paragraph and the privacy section:

- "Build visual family trees with relationships across generations"
- "Record trauma events, life events, and classifications"
- "Discover recurring patterns that ripple through time"

Styled as a compact list with a small accent-colored dot (`::before` pseudo-element) per item. `font-size: 13px`, `8px` gap between items, `16px` margin above and below the group.

### Inline passphrase explanation

On the register page, below the passphrase input (before the confirm passphrase field), a small hint:

- EN: "Your password protects your account. Your passphrase encrypts your data, so not even we can read it."
- NL: "Je wachtwoord beschermt je account. Je versleutelwachtwoord versleutelt je gegevens, zodat zelfs wij ze niet kunnen lezen."

Styled at `font-size: 12px`, `color: var(--color-text-muted)`, `line-height: 1.5`.

The existing warning text ("If you lose your passphrase, your data cannot be recovered") stays near the acknowledge checkbox at the bottom. The hint explains why two credentials exist; the warning explains the consequence.

## Changes

### New files

- `frontend/src/components/AuthWelcome.tsx` - shared welcome content component

### Modified files

- `frontend/src/pages/LoginPage.tsx` - remove inline explainer markup, render `<AuthWelcome />` above auth card
- `frontend/src/pages/RegisterPage.tsx` - add `<AuthWelcome />` above form card, add passphrase hint below passphrase field
- `frontend/src/styles/auth.css` - remove `order: 1/2` desktop swap, add feature list styles, add passphrase hint style, move border-top to auth card on desktop
- `frontend/public/locales/en/translation.json` - add `landing.feature1`, `landing.feature2`, `landing.feature3`, `auth.passphraseHint`
- `frontend/public/locales/nl/translation.json` - same keys in Dutch

### Unchanged

- UnlockPage (separate concern, already has its own hero variant)
- Auth logic, API, backend
- AuthHero component
- Footer

## Terminology

- English: "passphrase"
- Dutch: "versleutelwachtwoord"
