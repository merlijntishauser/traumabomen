# Rename "passphrase" to "encryption key" (reduce password/passphrase confusion)

Date: 2026-06-07

## Problem

Users confuse the two secrets:

- **Login password** authenticates to the server (bcrypt check, resettable by email).
- **Encryption passphrase** derives the AES-256 key client-side via Argon2id
  (never leaves the device, cannot be reset, lose it = data lost).

The names are near-identical: EN "password" vs "passphrase"; NL is worse, where
the login secret is "wachtwoord" and the passphrase is "versleutelingswachtwoord"
(both contain "wachtwoord"), used inconsistently as
`versleutelingswachtwoord` / `versleutelwachtwoord` / `wachtwoordzin`.

## Rejected idea: 4-6 digit PIN

The passphrase is the *key material*. The server stores only ciphertext, so the
secret is brute-forceable offline. A 4-digit PIN is 10^4 and a 6-digit PIN is
10^6 possibilities; even with Argon2id this is crackable in hours to days
(minutes on a GPU rig), which breaks the zero-knowledge guarantee. A PIN cannot
replace the passphrase. The real problem (confusion) is solved differently.

## Decision: rename + contrast (no crypto change)

Goal chosen: reduce confusion. Keep two secrets, but make them read as different
kinds of things.

### 1. Naming

User-facing term becomes **"encryption key"** (EN) / **"encryptiesleutel"** (NL).
A categorically different word from password/wachtwoord (not a near-synonym),
aligned with the existing encryption language, and it removes "wachtwoord" from
the second secret entirely in Dutch. Avoided "vault key" (clashes with the
nature/tree identity) and "recovery phrase" (implies recoverability).

### 2. Copy & contrast

Contrast the two on three axes, consistently:

| | Password | Encryption key |
|---|---|---|
| Verb | signs you in | unlocks your data |
| Reset? | can be reset by email | can never be reset, not even by us |
| Who holds it | checked by our server | only you ever have it |

- Rewrite the shared hint copy so it contrasts verbs + resettability rather than
  reading as two parallel "this protects X" sentences.
- One short helper line under each field naming its role.
- Icons: `Lock` for the password (sign-in), `Key` for the encryption key.
- Keep the irreversibility warning prominent on the encryption key.
- House voice: plain, "you/your", honest, no exclamation marks, no em-dash.

### 3. Registration flow

Already a 3-step wizard (`account` -> `encryption` -> `confirm`), so the two
secrets are already separated in time. Only copy/name/icon changes inside the
existing steps; no new steps. Step 2 retitled to name the thing
("Set your encryption key") with an explicit "this is a different secret from
your password" line.

### 4. Scope

Change only user-facing strings (i18n **values**), EN + NL. Keep i18n **keys**
(`auth.passphrase*`), component names (`PassphraseHintSection`), and crypto code
(`deriveKey(passphrase, salt)`) as-is, because "passphrase" is internally
accurate (a key is derived from a passphrase). Low churn, no logic change.

Touchpoints: registration steps 2-3; unlock page + auth/re-auth modal; account
settings (change key + hint); validation/error copy; show/hide labels; the
privacy policy, landing privacy section, and FAQ (seed + static fallback);
collapse the three Dutch variants to `encryptiesleutel`.

### 5. Testing & rollout

- No data migration, zero data risk: secret, salt, Argon2id, and ciphertext are
  unchanged. Existing keys and hints keep working; users just see new wording.
- Update component/integration and e2e tests that assert the old text.
- i18n EN/NL parity stays green (values change, not keys); re-verify style.
- Ships with the normal tagged deploy; no feature flag, no migration notice
  (the unlock context makes it obvious it is the same secret).

## Out of scope

- Renaming i18n keys, component names, or crypto identifiers.
- Any change to the number of secrets, the derivation, or storage.
- PIN / device-bound unlock / single-secret derivation (separate future ideas).
