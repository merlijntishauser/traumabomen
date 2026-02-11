# Frontend Tests

## Overview

Add Vitest unit tests, React Testing Library component tests, and a Playwright e2e test covering the core tree workflow.

## Test Infrastructure

**`vitest.config.ts`** -- Separate from vite.config.ts. Uses jsdom environment, enables globals, references a setup file. No WASM plugins (argon2 is not called in unit tests).

**`src/test/setup.ts`** -- Imports `@testing-library/jest-dom` for DOM matchers.

**`playwright.config.ts`** -- Base URL `http://localhost:5173`. Single Chromium project. No webServer config (docker compose manages services).

**Conventions:** Unit/component tests as `*.test.ts` / `*.test.tsx` next to source. Playwright tests in `e2e/`.

## Crypto Unit Tests

**`src/lib/crypto.test.ts`**

Generate a test AES-256-GCM key via Web Crypto directly (skip Argon2). Test cases:

- `generateSalt` returns base64 that decodes to 16 bytes
- `generateSalt` returns different values each call
- `encrypt` + `decrypt` round-trip preserves plaintext
- `encrypt` produces different IVs for same plaintext
- `encrypt` output shape: `{ iv: string, ciphertext: string }`
- `decrypt` with wrong key throws
- `encryptForApi` + `decryptFromApi` round-trip preserves objects
- `decryptFromApi` with corrupted ciphertext throws

## Component Tests

**`src/components/tree/PersonNode.test.tsx`**

- Renders name and birth year
- Shows death year when present
- Shows "(adopted)" when `is_adopted` is true
- Renders trauma badges with correct colors
- No badges when events array is empty

**`src/components/tree/PersonDetailPanel.test.tsx`**

- Person name in header
- Person details open by default, others collapsed
- Section toggles expand/collapse
- Save calls `onSavePerson` with updated data
- Delete requires two clicks (confirmation)
- "New event" shows EventForm
- Saving new event calls `onSaveEvent` with null id
- Editing event passes updated person IDs from checkboxes
- Can't uncheck last person in multi-person checkboxes
- Close calls `onClose`

Both mock `useTranslation` to return keys as-is.

## Playwright E2E Test

**`e2e/tree-workflow.spec.ts`**

Single flow:

1. Register with email/password
2. Enter encryption passphrase, acknowledge warning
3. Create tree from tree list
4. Add person A (Alice, 1960), save
5. Add person B (Bob, 1958), save
6. Connect A to B via drag-to-connect, select "Partner" from popover
7. Click Alice, add trauma event (fill title, category, date), save
8. Verify event badge on Alice's node
9. Navigate to timeline, verify both persons render
10. Logout
11. Login, enter passphrase
12. Verify Alice and Bob persist with relationship and event

Uses `registerAndUnlock` helper for the multi-step auth flow. Unique email per run via `Date.now()`.

## Files

**New:**
- `frontend/vitest.config.ts`
- `frontend/src/test/setup.ts`
- `frontend/playwright.config.ts`
- `frontend/src/lib/crypto.test.ts`
- `frontend/src/components/tree/PersonNode.test.tsx`
- `frontend/src/components/tree/PersonDetailPanel.test.tsx`
- `frontend/e2e/tree-workflow.spec.ts`

**Modified:** None.
