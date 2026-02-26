# Refresh Token Rotation

## Problem

Refresh tokens are stateless JWTs with a 7-day expiry. If a token is stolen, the attacker can mint access tokens for the full 7-day window. There is no way to revoke a compromised token. This is listed under "Authentication" in roadmap #18 (security hardening).

## Scope

Replace stateless JWT refresh tokens with opaque, single-use tokens backed by a database table. Each use returns a new refresh token and invalidates the old one. Reuse of a revoked token triggers family-wide revocation (all tokens from the same login session).

## Design

### Token lifecycle

**On login/register:** Generate a random opaque token (not a JWT), SHA-256 hash it, store the hash in a `refresh_tokens` table with `user_id`, `family_id` (UUID grouping tokens from the same login session), `expires_at`, and `revoked` flag. Return the plaintext token to the client alongside the access JWT.

**On refresh:** Client sends the plaintext refresh token. Server hashes it, looks up the row. If found, not revoked, and not expired: mark it as revoked, create a new token in the same family, return the new refresh token and a new access token.

**On reuse detection:** If the looked-up token is already revoked, revoke ALL tokens in that family (`UPDATE refresh_tokens SET revoked = true WHERE family_id = ?`). Return 401. Both the legitimate user and the attacker must re-login.

**On logout:** Revoke the current refresh token (client sends it in the request body).

### Database model

New `refresh_tokens` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to users, indexed |
| `token_hash` | String(64) | SHA-256 hex, unique, indexed |
| `family_id` | UUID | Groups tokens from same login, indexed |
| `expires_at` | DateTime(tz) | 7-day expiry |
| `revoked` | Boolean | Default false |
| `created_at` | DateTime(tz) | Server default now() |

No changes to the `users` table. Multiple sessions allowed (each login creates a separate family).

### API changes

**`POST /auth/refresh` (modified):**
- Request body unchanged: `{ "refresh_token": "..." }`
- Response adds `refresh_token`: `{ "access_token": "...", "refresh_token": "...", "token_type": "bearer" }`
- Flow: hash incoming token, look up row. Missing/expired: 401. Revoked: revoke entire family, 401. Valid: mark revoked, create new token in same family, return both.

**`POST /auth/login` and `POST /auth/register` (modified):**
- Replace JWT refresh token with opaque token. Create a new `family_id`, store hashed token, return plaintext.
- `_build_token_response` becomes async (needs db to store the refresh token).

**`POST /auth/logout` (new):**
- Body: `{ "refresh_token": "..." }`. Requires auth header.
- Revokes the token if it belongs to the authenticated user. Returns 200.

**`DELETE /auth/account` (modified):**
- Cascade-delete refresh tokens before deleting user (FK cascade or explicit).

### Frontend changes

**`frontend/src/lib/api.ts`:**
- `refreshAccessToken()`: Store both the new access token and new refresh token after refresh.
- `logout()`: Call `POST /auth/logout` with current refresh token before clearing localStorage. Fire-and-forget.

**`frontend/src/types/api.ts`:**
- `RefreshResponse`: Add `refresh_token: string`.

### Testing

**Backend (`test_auth.py`):**
- Refresh returns new access + refresh token
- Old refresh token rejected after use (single-use)
- Reuse of revoked token revokes entire family
- Expired refresh token returns 401
- Logout revokes the refresh token
- Multiple sessions are independent families
- Account deletion cascades to refresh tokens

**Frontend:** No new tests; the refresh logic pattern is unchanged, just stores one extra field.

## Files

**New:**
- `api/app/models/refresh_token.py`
- `api/alembic/versions/xxxx_add_refresh_tokens_table.py`

**Modified:**
- `api/app/auth.py`
- `api/app/routers/auth.py`
- `api/app/schemas/auth.py`
- `frontend/src/lib/api.ts`
- `frontend/src/types/api.ts`
- `api/tests/test_auth.py`
- `docs/roadmap.md`
