# Passphrase Recovery Hints and Auth Modals

## Context

The current unlock flow navigates users to a separate `/unlock` page after login, and session expiry redirects to `/login`, losing context. There is no passphrase recovery mechanism -- lost passphrase means lost data with no help.

This design adds three features:

1. **Passphrase hints** -- user-written reminder shown during unlock
2. **Auth modal** -- replaces the unlock page redirect with an overlay modal that preserves context
3. **Auto-lock on inactivity** -- clears the encryption key after configurable idle time

## Passphrase Hints

### Data model

New nullable column on the `users` table:

```
passphrase_hint: VARCHAR(255), nullable, default null
```

The hint is stored in plaintext server-side. It is metadata only, never involved in cryptographic operations.

### API changes

- `POST /auth/register` -- accept optional `passphrase_hint` field
- `GET /auth/salt` -- extend response to include `passphrase_hint` (nullable)
- `PUT /auth/hint` -- new endpoint to update or clear the hint (authenticated)

### Registration

New optional text input after "Confirm passphrase", before the acknowledgment checkbox:

- Label: "Passphrase hint (optional)"
- Helper text: "Write something that helps you remember your passphrase. Do not write the passphrase itself."
- Max 255 characters
- Sent as part of `POST /auth/register`

### Unlock / Auth Modal

If a hint exists, it is displayed below the passphrase input in a subtle styled block. If no hint is set, nothing is shown.

### Settings

Users can view and update their hint in the SettingsPanel account section. The `PUT /auth/hint` endpoint accepts `{ passphrase_hint: string | null }`. Setting to null clears it.

## Auth Modal

A full-viewport modal overlay that replaces the `/unlock` page redirect for the primary unlock experience.

### Visual design

- Full-viewport overlay covering the current page
- Unlock hero image fills the background (dark/light theme-aware, reuses existing `hero-unlock-dark.jpg` / `hero-unlock-light.jpg`)
- Passphrase form centered over the image in a frosted glass / semi-transparent card
- Hint displayed below the input (if set)
- Non-dismissable: no close button, no click-outside-to-close
- "Log in with a different account" link at the bottom
- Responsive: full-screen on mobile

### Two modes

**Unlock mode** (passphrase only):
- Used when JWT is still valid but encryption key is missing
- Shows passphrase input + hint
- After successful key derivation, modal dismisses

**Re-auth mode** (email/password + passphrase):
- Used when JWT has expired
- Step 1: email/password login form
- Step 2: passphrase input + hint
- After both succeed, modal dismisses

### When the modal appears

1. **After login**: Instead of redirecting to `/unlock`, the app redirects to `/trees`. The app detects JWT present but no encryption key in memory, and shows the AuthModal in unlock mode.
2. **Session expiry**: When a JWT refresh fails mid-session (401 response), the AuthModal appears in re-auth mode. The current page stays rendered behind the modal.
3. **Auto-lock**: When the inactivity timer fires, the encryption key is cleared and the AuthModal appears in unlock mode.

### Context preservation

The tree workspace (or any page) stays rendered behind the modal. After successful unlock, the modal disappears and the user continues exactly where they were. In-flight React Query queries retry automatically.

### Fallback

The `/unlock` route still exists for direct URL navigation and bookmarks, but the primary experience is the modal.

## Auto-Lock on Inactivity

### Behavior

After a configurable period of no user interaction, the encryption key is cleared from memory and the AuthModal appears in unlock mode. The user must re-enter their passphrase to continue. No re-authentication needed since the JWT session is still valid.

### Activity detection

Track mouse movement, keyboard input, touch, and scroll events. Any interaction resets the inactivity timer. Background API calls (React Query refetches) do not count as activity.

### Setting

Per-user preference stored in client-side canvas settings (encrypted):

```
autoLockMinutes: number  -- default 15
```

Options: 5, 15, 30, 60, or 0 (disabled). Configurable in SettingsPanel under the account section.

### Implementation

A `useAutoLock` hook inside or alongside EncryptionContext:

- Starts a timer on mount (default 15 minutes)
- Resets timer on user interaction events (debounced to avoid performance impact)
- When timer fires: calls `clearKey()` on EncryptionContext
- `clearKey()` sets `needsUnlock = true`, which triggers AuthModal
- Tree workspace stays rendered behind the modal, all state preserved
- After passphrase re-entry, key is re-derived, modal dismisses

### Edge cases

- Timer pauses when the tab is hidden (`visibilitychange` event) and resumes when visible. If total hidden time exceeds the threshold, lock immediately on tab focus.
- If the JWT also expires during the lock period, the modal switches to re-auth mode (email/password + passphrase).

## Component Architecture

| Component | Action | Description |
|-----------|--------|-------------|
| `AuthModal.tsx` | Create | Full-viewport modal with hero background, two modes (unlock / re-auth) |
| `AuthModal.css` | Create | Hero image background, frosted glass card, responsive |
| `useAutoLock.ts` | Create | Inactivity timer hook, activity event listeners |
| `EncryptionContext.tsx` | Edit | Expose `needsUnlock` state, integrate auto-lock |
| `RegisterPage.tsx` | Edit | Add optional hint field |
| `UnlockPage.tsx` | Edit | Add hint display (fallback route) |
| `SettingsPanel.tsx` | Edit | Add hint edit + auto-lock timeout setting |
| `App.tsx` | Edit | Render AuthModal at root level |
| `api/app/models/user.py` | Edit | Add `passphrase_hint` column |
| `api/app/routers/auth.py` | Edit | Accept hint in register, return in salt, add PUT hint |
| `api/app/schemas/auth.py` | Edit | Update request/response schemas |
| `api/alembic/versions/...` | Create | Migration for passphrase_hint column |
| `frontend/src/lib/api.ts` | Edit | Add hint API functions |
| `frontend/src/locales/en/translation.json` | Edit | English translations |
| `frontend/src/locales/nl/translation.json` | Edit | Dutch translations |

## Backend Summary

- **Migration**: `ALTER TABLE users ADD COLUMN passphrase_hint VARCHAR(255)`
- **Register**: Accept optional `passphrase_hint` in `POST /auth/register`
- **Salt endpoint**: Extend `GET /auth/salt` response to include `passphrase_hint`
- **Hint endpoint**: New `PUT /auth/hint` for updating/clearing the hint
- No changes to encryption, key derivation, or token management
