# Safety Envelope

## Context

The safety envelope is a three-layer protection system that wraps the entire user experience. The goal: set clear expectations, affirm autonomy, and provide emotional and visual safety -- without getting in the way.

This design builds on several existing features: the privacy page (with "At a glance" / "In depth" tabs), the mental health banner (dismissible crisis resources), the AppFooter (persistent crisis support link), and the planned auto-lock from the passphrase hints design. It consolidates and extends these into a coherent system.

### Three layers

| Layer | What | When | Frequency |
|---|---|---|---|
| Onboarding Gate | Fullscreen information step | After registration, before first tree view | Once |
| Safety Footer | Subtle reminder + lock affordance | Every authenticated page | Always |
| Lock + Blur | Panic/exit screen lock | On double-Esc, click, or inactivity | On demand |

## Layer 1: Onboarding Gate

After registration and passphrase setup, before the tree becomes visible: a fullscreen step. No sidebar, no distractions.

### Three blocks

**1. What this is**

> "Traumabomen is a personal reflection tool. It is not therapy and not crisis support."

**2. What this may bring up**

> "Exploring family patterns can be emotionally charged. You set the pace. Pause or stop whenever you want."

**3. What we cannot see**

> "Your data is encrypted before it leaves your device. The server sees no content."
>
> Link -> "How privacy works" (`/privacy`)

### Interaction

- One button: "I understand, continue"
- No checkbox, no legalistic feel -- a conscious step, not a contract
- Status saved as `onboarding_safety_acknowledged: true` (unencrypted, server-side on user model)
- Never shown again

### Implementation

- `OnboardingGate.tsx`: fullscreen overlay component rendered at app root level
- Shown when user is authenticated but `onboarding_safety_acknowledged` is false
- `GET /auth/me` response includes the flag; `PUT /auth/onboarding` sets it
- Blocks navigation to any tree view until acknowledged

## Layer 2: Safety Footer

Replaces the existing AppFooter. A narrow bar (~32px) at the bottom of every authenticated page. Muted color, low visual priority.

### Content

| Position | Element |
|---|---|
| Left | Heart icon + "Personal reflection tool -- not therapy" (small, muted) |
| Center | Crisis support link ("Need support?" + locale-specific resource) |
| Right | Lock icon "Lock screen" + privacy link |

### Behavior

- Fixed at viewport bottom, always visible
- Same visual priority as a copyright line
- Mobile: compact -- left shows icon + "Reflection tool" only. Crisis link and privacy link collapse into a single "more" tap or move to settings.
- Lock icon triggers Layer 3 (lock + blur)

### Existing code impact

- `AppFooter.tsx`: rewrite to merge existing crisis support content with new safety footer layout
- `MentalHealthBanner.tsx`: unchanged (dismissible banner remains separate, complementary)

## Layer 3: Lock + Blur

A visual panic button and privacy screen. Distinct from the planned AuthModal (which handles session expiry and full re-authentication).

### Two lock levels

| Level | Trigger | Key in memory | Unlock method | Use case |
|---|---|---|---|---|
| **Blur lock** | Double-Esc, footer icon, 5 min inactivity | Kept | Passphrase verification (bcrypt-like check, no re-derivation) | Quick hide, someone walks by |
| **Full lock** | 30 min inactivity, JWT expiry, manual logout | Cleared | Full passphrase re-derivation (Argon2id) | Extended absence, session end |

### Blur lock behavior

1. **Instant** (synchronous, no network): `filter: blur(20px)` on app container + overlay div
2. Overlay shows: lock icon, "Screen locked", passphrase input field
3. Encryption key stays **intact** in memory -- no re-decryption needed
4. **Correct passphrase** -> blur disappears, back where you were
5. **Wrong passphrase** -> shake animation on input field, counter +1
6. **5 wrong attempts** -> escalate to full lock (key cleared, full re-auth required)

### Passphrase verification for blur lock

The blur lock needs to verify the passphrase without re-deriving the key (which takes seconds via Argon2id). Approach: during initial key derivation, store a bcrypt hash of the passphrase in memory (alongside the key). On blur unlock, verify the entered passphrase against this in-memory hash. This is instant and never touches the network.

### Activation triggers

1. **Double-tap Esc** (within 500ms) -- anywhere in the app. Single Esc still closes panels (current behavior preserved).
2. **Click lock icon** in the safety footer.
3. **Auto-lock**: 5 minutes of inactivity triggers blur lock. 30 minutes triggers full lock (key cleared).
4. **Tab hidden** (`visibilitychange`) -- optional, off by default, configurable in settings.

### Keyboard isolation

While lockscreen active: all keyboard events captured except the passphrase input field. No Ctrl+A, Ctrl+C, no tab navigation to blurred content. Implemented via a capturing event listener on the overlay.

### Auto-lock timers

- **Blur lock**: 5 minutes of inactivity (configurable: 2, 5, 10, 15 minutes or disabled)
- **Full lock**: 30 minutes of inactivity (configurable: 15, 30, 60 minutes)
- Activity detection: mouse movement, keyboard input, touch, scroll (debounced). Background API calls do not count.
- Timer pauses when tab is hidden. If hidden time exceeds threshold, lock immediately on tab focus.
- Settings stored in encrypted canvas settings (client-side).

### Implementation

- `LockScreen.tsx`: fullscreen overlay with blur backdrop and passphrase form
- `LockScreen.css`: blur filter, overlay styling, shake animation
- `useLockScreen.ts`: global state hook managing lock level, inactivity timers, double-Esc detection
- Rendered at React app root level (in `App.tsx`), above all other content
- Integrates with `EncryptionContext`: blur lock reads the in-memory passphrase hash; full lock calls `clearKey()`

### Relationship to AuthModal (passphrase hints design)

The blur lock and AuthModal serve different purposes:

- **Blur lock**: quick visual hide, key stays, instant unlock. For privacy in shared spaces.
- **AuthModal**: session recovery, key re-derivation. For expired sessions and extended absence.

When auto-lock escalates from blur (5 min) to full (30 min), the blur overlay transitions to the AuthModal. The 5-wrong-attempts escalation also transitions to AuthModal.

## Privacy page enhancement

The existing `/privacy` page (with "At a glance" / "In depth" tabs) already covers encryption, data handling, and GDPR rights. No new route needed.

### Addition: visual encryption diagram

Add a simple three-step diagram to the "How encryption works" section of the privacy page:

```
You type  ->  Encrypted in your browser  ->  Server stores ???-blobs
```

Rendered as a styled HTML/CSS element (not an image). Below the diagram, a collapsible "Technical details" block with: Argon2id key derivation, AES-256-GCM, Web Crypto API, fresh IV per encryption.

## Tone and principles

- **Warm and personal** -- not clinical, not legalistic
- **Autonomy-affirming** -- "you decide", "whenever you want"
- **Honest about tradeoffs** -- passphrase lost = data lost
- **Never in the way** -- present but not intrusive
- **Consistent** -- same tone across onboarding, footer, privacy page, and lockscreen

## Component architecture

| Component | Action | Description |
|---|---|---|
| `OnboardingGate.tsx` | Create | Fullscreen post-registration information step |
| `OnboardingGate.css` | Create | Fullscreen overlay styling |
| `LockScreen.tsx` | Create | Blur lock overlay with passphrase verification |
| `LockScreen.css` | Create | Blur filter, overlay, shake animation |
| `useLockScreen.ts` | Create | Lock state, inactivity timers, double-Esc detection |
| `AppFooter.tsx` | Rewrite | Merge crisis support + safety disclaimer + lock affordance |
| `AppFooter.css` | Edit | Updated footer layout with three sections |
| `EncryptionContext.tsx` | Edit | Store passphrase hash in memory for blur lock verification |
| `App.tsx` | Edit | Render OnboardingGate and LockScreen at root level |
| `PrivacyPage.tsx` | Edit | Add visual encryption diagram |
| `api/app/models/user.py` | Edit | Add `onboarding_safety_acknowledged` column |
| `api/app/routers/auth.py` | Edit | Return flag in user info, add PUT endpoint |
| `api/app/schemas/auth.py` | Edit | Update schemas |
| `api/alembic/versions/...` | Create | Migration for new column |
| `locales/en/translation.json` | Edit | English translations for all safety envelope text |
| `locales/nl/translation.json` | Edit | Dutch translations for all safety envelope text |

## i18n keys

```
safety.onboarding.whatThisIs
safety.onboarding.whatThisIsBody
safety.onboarding.whatThisMayBringUp
safety.onboarding.whatThisMayBringUpBody
safety.onboarding.whatWeCannotSee
safety.onboarding.whatWeCannotSeeBody
safety.onboarding.continue
safety.footer.disclaimer
safety.footer.support
safety.footer.lock
safety.footer.privacy
safety.lock.title
safety.lock.passphrase
safety.lock.wrongPassphrase
safety.lock.tooManyAttempts
safety.lock.unlock
```
