# Passkey Authentication

## Context

The app currently uses email+password for authentication and a separate encryption passphrase for key derivation. Passkeys (WebAuthn/FIDO2) offer a faster, phishing-resistant login method using biometrics, device PIN, or security keys.

This design adds passkeys as an **alternative login method** alongside email+password. The encryption passphrase remains unchanged -- passkeys handle authentication only, not encryption. Users still enter their passphrase after login to derive the AES-256 key.

The WebAuthn PRF extension could theoretically replace the passphrase too, but platform support is still fragmented (iOS bugs through 18.3, no Windows Hello support). That can be revisited later.

## Data Model

New `webauthn_credentials` table:

```
id: UUID (primary key)
user_id: UUID (FK -> users, indexed)
credential_id: bytes (unique, indexed)  -- WebAuthn credential identifier
public_key: bytes                       -- credential public key
sign_count: int                         -- replay attack counter
rp_id: str                              -- relying party domain (traumatrees.org or traumabomen.nl)
name: str                               -- user-given label, e.g. "MacBook Pro"
created_at: datetime
last_used_at: datetime (nullable)
```

A user can have zero or many credentials. The table is not encrypted -- public keys are public by definition. Credentials are scoped to their `rp_id`, so a passkey registered on `traumatrees.org` is separate from one on `traumabomen.nl`.

## Multi-Domain Handling

The app is hosted on two domains (`www.traumatrees.org` and `www.traumabomen.nl`). WebAuthn credentials are bound to the relying party ID (domain), so the backend determines RP ID and origin dynamically from the request's `Origin` header, validated against an allow-list:

```
WEBAUTHN_ALLOWED_ORIGINS=https://www.traumatrees.org,https://www.traumabomen.nl
```

Request mapping:
- `www.traumatrees.org` -> RP ID `traumatrees.org`, origin `https://www.traumatrees.org`
- `www.traumabomen.nl` -> RP ID `traumabomen.nl`, origin `https://www.traumabomen.nl`
- Local dev -> RP ID `localhost`, origin `http://localhost:5173`

The RP name is `Traumabomen` on both domains.

When generating authentication options, only credentials matching the current RP ID are offered. The settings panel shows which domain each passkey belongs to.

## API Endpoints

All under `/auth/passkey/`:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /auth/passkey/register/options` | JWT required | Generate WebAuthn registration options |
| `POST /auth/passkey/register/verify` | JWT required | Verify registration, store credential |
| `POST /auth/passkey/login/options` | Public | Generate authentication options (discoverable) |
| `POST /auth/passkey/login/verify` | Public | Verify assertion, return tokens + salt |
| `GET /auth/passkeys` | JWT required | List user's passkeys (id, name, rp_id, created_at, last_used_at) |
| `DELETE /auth/passkeys/{id}` | JWT required | Remove a passkey |

## Login Flow with Passkeys

1. User clicks "Sign in with passkey" on the login page
2. Frontend calls `POST /auth/passkey/login/options` (no email needed -- discoverable credentials)
3. Backend generates a challenge with `generate_authentication_options()`, stores it in an in-memory cache (60s TTL), returns options JSON
4. Frontend passes options to `navigator.credentials.get()` -- browser shows the native passkey picker
5. Frontend sends the assertion to `POST /auth/passkey/login/verify`
6. Backend verifies with `verify_authentication_response()`, looks up credential by `credential_id`, finds the user, increments `sign_count`, updates `last_used_at`, records a `LoginEvent`, returns `TokenResponse` (access token + refresh token + encryption_salt)
7. Frontend stores tokens, redirects to unlock (passphrase entry) -- identical to existing post-login flow

Email verification is still enforced: if the user's email isn't verified, passkey login returns 403.

## Passkey Registration Flow

1. User clicks "Add passkey" (from settings or post-login prompt) and enters a name
2. Frontend calls `POST /auth/passkey/register/options` (authenticated)
3. Backend generates registration options, includes existing credential IDs in `excludeCredentials`, stores challenge (60s TTL), returns options JSON
4. Frontend passes options to `navigator.credentials.create()` -- browser prompts biometric/PIN
5. Frontend sends attestation + name to `POST /auth/passkey/register/verify`
6. Backend verifies with `verify_registration_response()`, stores credential row, returns success

## Challenge Storage

WebAuthn ceremonies are two-step (generate options, then verify). The challenge from step 1 must be available in step 2.

In-memory `dict[str, ChallengeData]` with a background cleanup task evicting entries older than 60 seconds. Keyed by challenge value (base64url-encoded). No new infrastructure needed. Sufficient for single-instance Cloud Run deployment.

## Frontend

### Login page

"Sign in with passkey" button below the email+password form, separated by a divider. Only shown when `window.PublicKeyCredential !== undefined`.

### Settings panel

New "Passkeys" section in the account area:

- List of registered passkeys: name, domain, created date, last used date
- Delete button per passkey (with confirmation)
- "Add passkey" button
- Info message if browser doesn't support WebAuthn

### Post-login prompt

After a successful login+unlock, if the user has zero passkeys and hasn't dismissed the prompt before, show a banner:

> "Speed up your login with a passkey. Use your fingerprint, face, or device PIN instead of typing your password."
> [Set up passkey] [Not now]

Dismissal stored in localStorage (`passkey_prompt_dismissed`). Not shown if user already has passkeys.

### Feature detection

```typescript
const passkeySupported = window.PublicKeyCredential !== undefined;
```

All passkey UI hidden entirely when unsupported.

## Dependencies

- Backend: `py-webauthn` v2.7.1
- Frontend: `@simplewebauthn/browser`

## Files

| File | Action | Description |
|------|--------|-------------|
| `api/app/models/webauthn_credential.py` | Create | SQLAlchemy model for webauthn_credentials table |
| `api/app/routers/passkey.py` | Create | All 6 passkey endpoints |
| `api/app/schemas/passkey.py` | Create | Request/response schemas |
| `api/app/passkey_challenges.py` | Create | In-memory challenge store with 60s TTL |
| `api/app/config.py` | Edit | Add `WEBAUTHN_ALLOWED_ORIGINS` setting |
| `api/app/main.py` | Edit | Register passkey router |
| `api/alembic/versions/...` | Create | Migration for webauthn_credentials table |
| `frontend/src/lib/api.ts` | Edit | Add passkey API functions |
| `frontend/src/pages/LoginPage.tsx` | Edit | Add "Sign in with passkey" button + flow |
| `frontend/src/components/tree/SettingsPanel.tsx` | Edit | Add passkey management section |
| `frontend/src/components/PasskeyPrompt.tsx` | Create | Post-login banner prompting passkey setup |
| `frontend/src/pages/TreeListPage.tsx` | Edit | Render PasskeyPrompt |
| `frontend/src/locales/en/translation.json` | Edit | English translations |
| `frontend/src/locales/nl/translation.json` | Edit | Dutch translations |

No changes to: EncryptionContext, crypto.ts, UnlockPage, RegisterPage, or the existing login endpoint. The passkey flow runs parallel to the existing auth flow and converges at the same token+unlock step.
