# Password Strength Validation

## Problem

The February 2026 security audit identified that no password strength validation exists on either the client or the server. Users can register or change their password to any string, including single characters. This is listed under "Authentication" in roadmap #18 (security hardening).

## Scope

Authentication password only. The encryption passphrase is excluded (it already has an 8-character minimum and serves a different purpose).

## Design

### Scoring function

A pure function `getPasswordStrength(password)` returns `{ score, level }`.

**Hard gates:**
- Minimum 8 characters
- Maximum 64 characters

**Score (0-5):**
- +1 for length >= 8
- +1 for length >= 12
- +1 for length >= 16
- +1 for having both uppercase and lowercase
- +1 for having digits or symbols

**Levels:**
- Weak: score 0-2 (blocked from submission)
- Fair: score 3 (allowed)
- Strong: score 4-5 (allowed)

The same logic is implemented in both TypeScript and Python. No shared code, but identical rules.

### Frontend: strength meter component

`<PasswordStrengthMeter password={string} />` renders below the password input on the register page and the settings panel password change form.

**Visual:** A horizontal bar (full input width) with three segments that fill left-to-right:
- Weak: first segment, red (`--color-danger`)
- Fair: two segments, amber (`--color-warning`, new CSS variable)
- Strong: all three segments, green (`--color-success`, new CSS variable)

Below the bar: a translated level label (`password.weak`, `password.fair`, `password.strong`). Hidden when the password field is empty.

**Animation:** `0.15s ease` width transition on segments.

**Submit integration:** The submit button is disabled when the password scores "weak". Existing "passwords don't match" validation continues to run alongside.

No tooltip, no requirements checklist. The meter alone communicates strength.

### Frontend: page changes

**RegisterPage:** Add `<PasswordStrengthMeter>` below the password field. Add `maxLength={64}` to the password input. Disable submit when password is weak.

**SettingsPanel (change password section):** Add `<PasswordStrengthMeter>` below the new password field. Add `maxLength={64}` to the new password input. Disable submit when new password is weak.

### Server-side validation

`check_password_strength(password)` in `app/auth.py` returns `{"score": int, "level": str}` with identical logic.

**Endpoints affected:**
- `POST /auth/register`: reject password with score < 3 as 422 `password_too_weak`, reject > 64 chars as 422 `password_too_long`
- `PUT /auth/password`: same validation on `new_password`

No changes to login. No migration for existing users; they encounter the meter only when changing their password.

### Theme additions

Two new CSS variables in `theme.css` for both dark and light themes:
- `--color-warning`: amber tone
- `--color-success`: green tone (distinct from the accent green)

### i18n keys

English:
- `password.weak`: "Weak"
- `password.fair`: "Fair"
- `password.strong`: "Strong"
- `auth.passwordTooWeak`: "Password is too weak"
- `auth.passwordTooLong`: "Password must be 64 characters or fewer"

Dutch equivalents added to `nl/translation.json`.

## Testing

**Frontend unit (`passwordStrength.test.ts`):**
- Below 8 chars returns weak
- 8 chars single-case returns weak (score 2)
- 12 chars single-case returns fair (score 3)
- 12+ chars mixed case + digit returns strong
- Over 64 chars edge case
- Empty string returns weak

**Component (`PasswordStrengthMeter.test.tsx`):**
- Nothing rendered for empty password
- Correct label and segment coloring for each level

**Register page and settings panel tests (update existing):**
- Submit disabled when password is weak
- Submit enabled when password is fair or strong
- Meter visible below password field

**Backend (`test_auth.py`):**
- `check_password_strength` unit tests (same cases)
- Register with weak password returns 422
- Register with fair password succeeds
- Change password with weak new password returns 422
- Change password with > 64 chars returns 422

## Files

**New:**
- `frontend/src/lib/passwordStrength.ts`
- `frontend/src/lib/passwordStrength.test.ts`
- `frontend/src/components/PasswordStrengthMeter.tsx`
- `frontend/src/components/PasswordStrengthMeter.test.tsx`
- `frontend/src/components/PasswordStrengthMeter.css`

**Modified:**
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/components/tree/SettingsPanel.tsx`
- `frontend/src/styles/theme.css`
- `frontend/public/locales/en/translation.json`
- `frontend/public/locales/nl/translation.json`
- `api/app/auth.py`
- `api/app/routers/auth.py`
- `docs/roadmap.md`
- Existing test files for RegisterPage, SettingsPanel, backend auth
