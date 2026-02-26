# Refresh Token Rotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace stateless JWT refresh tokens with opaque, single-use, database-backed tokens with family-wide revocation on reuse detection.

**Architecture:** A new `refresh_tokens` table stores SHA-256 hashed opaque tokens grouped by family (one family per login session). Each refresh consumes the current token and issues a new one. Reuse of a revoked token revokes the entire family. The frontend stores and rotates the refresh token in localStorage alongside the access JWT.

**Tech Stack:** FastAPI, SQLAlchemy (async), Alembic, Vitest, pytest. No new dependencies.

**Design doc:** `docs/plans/2026-02-26-refresh-token-rotation-design.md`

---

### Task 1: RefreshToken database model and migration

**Files:**
- Create: `api/app/models/refresh_token.py`
- Modify: `api/alembic/env.py` (import model so Alembic sees it)

**Step 1: Create the model**

Create `api/app/models/refresh_token.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

**Step 2: Generate the Alembic migration**

Run: `docker compose exec api uv run alembic revision --autogenerate -m "add refresh_tokens table"`

If autogenerate doesn't detect the model, ensure it's imported in `alembic/env.py` by adding:

```python
import app.models.refresh_token  # noqa: F401
```

Then run: `docker compose exec api uv run alembic upgrade head`

**Step 3: Verify the migration applies cleanly**

Run: `docker compose exec api uv run alembic current`
Expected: Shows the new revision as head.

**Step 4: Commit**

```bash
git add api/app/models/refresh_token.py api/alembic/versions/*.py
git commit -m "Add refresh_tokens database model and migration"
```

---

### Task 2: Backend refresh token functions in auth.py

**Files:**
- Modify: `api/app/auth.py`
- Modify: `api/tests/test_auth.py`

**Step 1: Write the unit tests**

Add to `api/tests/test_auth.py` after the `TestPasswordStrength` class (around line 90). These test the pure/DB functions in isolation:

```python
import hashlib
import secrets

class TestRefreshTokenFunctions:
    @pytest.mark.asyncio
    async def test_create_refresh_token_returns_plaintext_and_stores_hash(self, db_session):
        from app.auth import create_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        assert len(plaintext) > 20  # opaque token, not empty

        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        result = await db_session.execute(
            __import__("sqlalchemy").select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        row = result.scalar_one()
        assert row.user_id == user.id
        assert row.family_id == family_id
        assert row.revoked is False

    @pytest.mark.asyncio
    async def test_use_refresh_token_returns_user_and_revokes(self, db_session):
        from app.auth import create_refresh_token, use_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        result = await use_refresh_token(plaintext, db_session)
        assert result is not None
        user_row, old_family_id = result
        assert user_row.id == user.id
        assert old_family_id == family_id

        # Old token is now revoked
        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        res = await db_session.execute(
            __import__("sqlalchemy").select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        assert res.scalar_one().revoked is True

    @pytest.mark.asyncio
    async def test_use_revoked_token_revokes_entire_family(self, db_session):
        from app.auth import create_refresh_token, use_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        token1 = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        # Use token1 (marks it revoked, would normally issue token2)
        await use_refresh_token(token1, db_session)

        # Create a second token in the same family (simulates what refresh endpoint does)
        token2 = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        # Replay token1 (already revoked) -> should revoke entire family
        result = await use_refresh_token(token1, db_session)
        assert result is None  # rejected

        # token2 should now also be revoked
        token2_hash = hashlib.sha256(token2.encode()).hexdigest()
        res = await db_session.execute(
            __import__("sqlalchemy").select(RefreshToken).where(RefreshToken.token_hash == token2_hash)
        )
        assert res.scalar_one().revoked is True

    @pytest.mark.asyncio
    async def test_use_expired_token_returns_none(self, db_session):
        from app.auth import create_refresh_token, use_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        # Manually expire it
        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        from sqlalchemy import update
        await db_session.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(expires_at=datetime(2020, 1, 1, tzinfo=UTC))
        )
        await db_session.commit()

        result = await use_refresh_token(plaintext, db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_use_nonexistent_token_returns_none(self, db_session):
        from app.auth import use_refresh_token

        result = await use_refresh_token("totally-fake-token", db_session)
        assert result is None

    @pytest.mark.asyncio
    async def test_revoke_refresh_token(self, db_session):
        from app.auth import create_refresh_token, revoke_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        revoked = await revoke_refresh_token(plaintext, user.id, db_session)
        assert revoked is True

        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        res = await db_session.execute(
            __import__("sqlalchemy").select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        assert res.scalar_one().revoked is True

    @pytest.mark.asyncio
    async def test_revoke_refresh_token_wrong_user(self, db_session):
        from app.auth import create_refresh_token, revoke_refresh_token

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        other_user = await create_user(db_session, email="other@example.com")
        revoked = await revoke_refresh_token(plaintext, other_user.id, db_session)
        assert revoked is False
```

**Step 2: Run tests to verify they fail**

Run: `docker compose exec api uv run pytest tests/test_auth.py::TestRefreshTokenFunctions -v`
Expected: FAIL (functions not found)

**Step 3: Implement the functions**

In `api/app/auth.py`, add these imports at the top (alongside existing ones):

```python
import hashlib
import secrets
```

After the `check_password_strength` function (line 46), add:

```python
async def create_refresh_token(
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    db: AsyncSession,
    settings: Settings,
) -> str:
    """Create an opaque refresh token, store its hash, return the plaintext."""
    from app.models.refresh_token import RefreshToken

    plaintext = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    row = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(row)
    await db.flush()
    return plaintext


async def use_refresh_token(
    plaintext: str,
    db: AsyncSession,
) -> tuple[User, uuid.UUID] | None:
    """Consume a refresh token. Returns (user, family_id) or None.

    If the token is already revoked (replay attack), revokes the entire
    family and returns None.
    """
    from app.models.refresh_token import RefreshToken

    token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()

    if row is None:
        return None

    if row.revoked:
        # Reuse detected: revoke entire family
        await db.execute(
            __import__("sqlalchemy").update(RefreshToken)
            .where(RefreshToken.family_id == row.family_id)
            .values(revoked=True)
        )
        await db.flush()
        return None

    if row.expires_at <= datetime.now(UTC):
        return None

    # Mark as used (revoked)
    row.revoked = True
    await db.flush()

    # Look up the user
    user_result = await db.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return None

    return user, row.family_id


async def revoke_refresh_token(
    plaintext: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Revoke a specific refresh token. Returns True if found and owned by user."""
    from app.models.refresh_token import RefreshToken

    token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    row.revoked = True
    await db.flush()
    return True
```

Note: Use inline `from app.models.refresh_token import RefreshToken` to avoid circular imports. Also replace `__import__("sqlalchemy").update` with a proper import: add `from sqlalchemy import select, update` at the top (update is already available via the existing `select` import; add `update` to it).

Actually, `update` is not currently imported in `auth.py`. Add it: change `from sqlalchemy import select` to `from sqlalchemy import select, update`.

And in the test file, similarly use proper imports instead of `__import__("sqlalchemy")`. Add at the top of test_auth.py: `from sqlalchemy import select, update` and use those in the tests.

**Step 4: Run tests to verify they pass**

Run: `docker compose exec api uv run pytest tests/test_auth.py::TestRefreshTokenFunctions -v`
Expected: PASS (7 tests)

**Step 5: Run all backend tests**

Run: `docker compose exec api uv run pytest -v`
Expected: PASS

**Step 6: Commit**

```bash
git add api/app/auth.py api/tests/test_auth.py
git commit -m "Add refresh token create, use, and revoke functions"
```

---

### Task 3: Update auth endpoints to use opaque refresh tokens

**Files:**
- Modify: `api/app/routers/auth.py:11-18` (imports), `60-66` (_build_token_response), `278-305` (refresh endpoint)
- Modify: `api/app/schemas/auth.py:34-36` (RefreshResponse)

**Step 1: Update the RefreshResponse schema**

In `api/app/schemas/auth.py`, change line 34-36:

```python
class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
```

**Step 2: Add LogoutRequest schema**

In `api/app/schemas/auth.py`, after `RefreshResponse` (line 36), add:

```python
class LogoutRequest(BaseModel):
    refresh_token: str
```

And add `LogoutRequest` to the import in `routers/auth.py`.

**Step 3: Update `_build_token_response` to be async and create opaque tokens**

In `api/app/routers/auth.py`, update the import (line 11-18) to include the new functions:

```python
from app.auth import (
    check_password_strength,
    create_refresh_token,
    create_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
```

Change `_build_token_response` (line 60-66) from:

```python
def _build_token_response(user: User, settings: Settings) -> TokenResponse:
    return TokenResponse(
        access_token=create_token(user.id, "access", settings, is_admin=user.is_admin),
        refresh_token=create_token(user.id, "refresh", settings),
        encryption_salt=user.encryption_salt,
        onboarding_safety_acknowledged=user.onboarding_safety_acknowledged,
    )
```

to:

```python
async def _build_token_response(
    user: User, settings: Settings, db: AsyncSession
) -> TokenResponse:
    import uuid as _uuid

    family_id = _uuid.uuid4()
    refresh_plaintext = await create_refresh_token(user.id, family_id, db, settings)
    return TokenResponse(
        access_token=create_token(user.id, "access", settings, is_admin=user.is_admin),
        refresh_token=refresh_plaintext,
        encryption_salt=user.encryption_salt,
        onboarding_safety_acknowledged=user.onboarding_safety_acknowledged,
    )
```

**Step 4: Update all callers of `_build_token_response`**

In the `register` endpoint (line 168), change:
```python
    return _build_token_response(user, settings)
```
to:
```python
    return await _build_token_response(user, settings, db)
```

In the `login` endpoint (line 199), change:
```python
    return _build_token_response(user, settings)
```
to:
```python
    return await _build_token_response(user, settings, db)
```

**Step 5: Rewrite the refresh endpoint**

Replace the entire `refresh` function (lines 278-305) with:

```python
@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RefreshResponse:
    from app.auth import use_refresh_token

    result = await use_refresh_token(body.refresh_token, db)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    user, family_id = result
    new_refresh = await create_refresh_token(user.id, family_id, db, settings)
    await db.commit()

    return RefreshResponse(
        access_token=create_token(user.id, "access", settings, is_admin=user.is_admin),
        refresh_token=new_refresh,
    )
```

**Step 6: Add the logout endpoint**

After the `refresh` endpoint, add:

```python
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    from app.auth import revoke_refresh_token

    await revoke_refresh_token(body.refresh_token, user.id, db)
    await db.commit()
    return {"message": "Logged out"}
```

Import `LogoutRequest` in the imports block at the top of the file.

**Step 7: Run type check**

Run: `docker compose exec api uv run mypy app/`
Expected: No errors

**Step 8: Run all backend tests**

Run: `docker compose exec api uv run pytest -v`
Expected: Existing refresh tests will FAIL because they still use JWT-based refresh tokens. That's expected; we fix them in the next task.

**Step 9: Commit**

```bash
git add api/app/routers/auth.py api/app/schemas/auth.py
git commit -m "Update auth endpoints for opaque refresh token rotation"
```

---

### Task 4: Update existing backend tests for new refresh token flow

**Files:**
- Modify: `api/tests/test_auth.py`
- Modify: `api/tests/conftest.py`

**Step 1: Update conftest.py**

The existing tests use `create_token(user.id, "refresh", TEST_SETTINGS)` to create refresh tokens directly. This no longer works because refresh tokens are now opaque, not JWTs.

Add a helper to `api/tests/conftest.py` after the `create_user` function (line 207):

```python
async def create_test_refresh_token(
    db: AsyncSession, user_id: uuid.UUID
) -> str:
    """Create an opaque refresh token for testing."""
    from app.auth import create_refresh_token

    family_id = uuid.uuid4()
    plaintext = await create_refresh_token(user_id, family_id, db, TEST_SETTINGS)
    await db.commit()
    return plaintext
```

Also add a timezone fixer for the RefreshToken model (similar to the User fixer at lines 98-103):

```python
from app.models.refresh_token import RefreshToken as _RefreshToken

@event.listens_for(_RefreshToken, "load")
def _fix_refresh_token_tz(target, _context):
    for attr in ("expires_at", "created_at"):
        val = getattr(target, attr, None)
        if val is not None and val.tzinfo is None:
            object.__setattr__(target, attr, val.replace(tzinfo=UTC))
```

**Step 2: Rewrite TestRefresh**

Replace the entire `TestRefresh` class (lines 230-248) with:

```python
class TestRefresh:
    @pytest.mark.asyncio
    async def test_refresh_returns_new_tokens(self, client, db_session):
        user = await create_user(db_session, email="refresh@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)

        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != refresh_token  # rotated

    @pytest.mark.asyncio
    async def test_refresh_token_is_single_use(self, client, db_session):
        user = await create_user(db_session, email="single-use@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)

        # First use succeeds
        resp1 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp1.status_code == 200

        # Second use of same token fails
        resp2 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp2.status_code == 401

    @pytest.mark.asyncio
    async def test_reuse_revokes_entire_family(self, client, db_session):
        user = await create_user(db_session, email="family@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)

        # First refresh: get a new token
        resp1 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp1.status_code == 200
        new_token = resp1.json()["refresh_token"]

        # Replay old token: triggers family revocation
        resp2 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp2.status_code == 401

        # New token should also be revoked now
        resp3 = await client.post("/auth/refresh", json={"refresh_token": new_token})
        assert resp3.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client):
        resp = await client.post("/auth/refresh", json={"refresh_token": "invalid"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_multiple_sessions_independent(self, client, db_session):
        user = await create_user(db_session, email="multi@example.com")
        token_a = await create_test_refresh_token(db_session, user.id)
        token_b = await create_test_refresh_token(db_session, user.id)

        # Both should work independently
        resp_a = await client.post("/auth/refresh", json={"refresh_token": token_a})
        resp_b = await client.post("/auth/refresh", json={"refresh_token": token_b})
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
```

**Step 3: Rewrite TestRefreshDeletedUser**

Replace the `TestRefreshDeletedUser` class (lines 532-542) with:

```python
class TestRefreshDeletedUser:
    @pytest.mark.asyncio
    async def test_refresh_for_deleted_user(self, client, db_session):
        """Refresh token for a user that no longer exists returns 401."""
        user = await create_user(db_session, email="gone@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)
        await db_session.delete(user)
        await db_session.commit()

        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 401
```

**Step 4: Add TestLogout**

After the TestRefresh class, add:

```python
class TestLogout:
    @pytest.mark.asyncio
    async def test_logout_revokes_token(self, client, db_session):
        user = await create_user(db_session, email="logout@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)
        hdrs = auth_headers(user.id)

        resp = await client.post(
            "/auth/logout",
            json={"refresh_token": refresh_token},
            headers=hdrs,
        )
        assert resp.status_code == 200

        # Token should no longer work
        resp2 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp2.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_unauthenticated(self, client):
        resp = await client.post(
            "/auth/logout",
            json={"refresh_token": "anything"},
        )
        assert resp.status_code == 401
```

**Step 5: Update TestProtectedEndpoint**

In `TestProtectedEndpoint.test_refresh_token_as_access` (line 270-273): this test used a JWT refresh token as a Bearer header. Since refresh tokens are now opaque (not JWTs), using one as a Bearer token will still fail with 401 (it won't decode as a valid JWT). The test should still pass as-is, but update the token creation:

```python
    @pytest.mark.asyncio
    async def test_opaque_refresh_token_as_access(self, client, db_session):
        user = await create_user(db_session, email="opaque@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)
        resp = await client.get("/trees", headers={"Authorization": f"Bearer {refresh_token}"})
        assert resp.status_code == 401
```

**Step 6: Add login/register integration test**

Add to `TestLogin`:

```python
    @pytest.mark.asyncio
    async def test_login_returns_opaque_refresh_token(self, client, db_session):
        """Login returns an opaque refresh token that can be used to refresh."""
        await create_user(db_session, email="opaque-login@example.com")
        resp = await client.post(
            "/auth/login",
            json={"email": "opaque-login@example.com", "password": "TestPassword1"},
        )
        assert resp.status_code == 200
        refresh_token = resp.json()["refresh_token"]

        # Use the refresh token
        resp2 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp2.status_code == 200
        assert "refresh_token" in resp2.json()
```

**Step 7: Update test imports**

At the top of `test_auth.py`, add `create_test_refresh_token` to the conftest import:

```python
from tests.conftest import TEST_SETTINGS, auth_headers, create_test_refresh_token, create_user
```

**Step 8: Run all backend tests**

Run: `docker compose exec api uv run pytest -v`
Expected: ALL PASS

**Step 9: Run type check and security check**

Run: `docker compose exec api uv run mypy app/`
Run: `docker compose exec api uv run bandit -r app/`
Expected: No issues

**Step 10: Commit**

```bash
git add api/tests/test_auth.py api/tests/conftest.py
git commit -m "Update tests for refresh token rotation"
```

---

### Task 5: Frontend changes

**Files:**
- Modify: `frontend/src/types/api.ts:38-41` (RefreshResponse)
- Modify: `frontend/src/lib/api.ts:150-176` (refreshAccessToken), `236-238` (logout)
- Modify: `frontend/src/hooks/useLogout.ts` (call async logout)

**Step 1: Update RefreshResponse type**

In `frontend/src/types/api.ts`, change lines 38-41:

```typescript
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
```

**Step 2: Update refreshAccessToken to store new refresh token**

In `frontend/src/lib/api.ts`, update the `refreshAccessToken` function (lines 150-176). Change line 163 from:

```typescript
      localStorage.setItem(TOKEN_KEY, data.access_token);
```

to:

```typescript
      setTokens(data.access_token, data.refresh_token);
```

**Step 3: Update logout to call the server**

In `frontend/src/lib/api.ts`, change the `logout` function (lines 236-238) from:

```typescript
export function logout(): void {
  clearTokens();
}
```

to:

```typescript
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearTokens();
  if (refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refresh_token: refreshToken },
      });
    } catch {
      // Fire-and-forget: don't block logout if server call fails
    }
  }
}
```

Note: `clearTokens()` is called first (before the server call) so the user sees immediate logout regardless of network issues. The `apiFetch` call uses the access token from the header (which was in localStorage before `clearTokens`). We need to capture the access token before clearing. Adjust:

```typescript
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();
  clearTokens();
  if (refreshToken && accessToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refresh_token: refreshToken },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Fire-and-forget: don't block logout if server call fails
    }
  }
}
```

Wait, `apiFetch` doesn't accept a custom `headers` option. Looking at the code, it builds headers internally. Since we call `clearTokens()` first, the auth header won't be set. We need to either:
- (a) Send the server request before clearing tokens, or
- (b) Pass the token manually.

Simplest approach: send the request first, then clear:

```typescript
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refresh_token: refreshToken },
      });
    } catch {
      // Fire-and-forget: don't block logout if server call fails
    }
  }
  clearTokens();
}
```

**Step 4: Update useLogout to handle async logout**

In `frontend/src/hooks/useLogout.ts`, `logout()` is now async. The hook calls it synchronously inside `useCallback`. Since logout is fire-and-forget (we clear tokens and navigate immediately), change:

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEncryption } from "../contexts/EncryptionContext";
import { logout } from "../lib/api";

export function useLogout() {
  const navigate = useNavigate();
  const { clearKey } = useEncryption();
  const queryClient = useQueryClient();

  return useCallback(() => {
    void logout();
    clearKey();
    queryClient.clear();
    navigate("/login");
  }, [clearKey, queryClient, navigate]);
}
```

The `void` keyword fires the async function without awaiting it. The local state clearing and navigation happen immediately.

**Step 5: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/lib/api.ts frontend/src/hooks/useLogout.ts
git commit -m "Update frontend for refresh token rotation"
```

---

### Task 6: Update roadmap and run full verification

**Files:**
- Modify: `docs/roadmap.md`

**Step 1: Update roadmap**

In `docs/roadmap.md`, find line 135 (or wherever "Refresh token rotation" is) and change:
```
- Refresh token rotation (single-use tokens to limit stolen-token window)
```
to:
```
- ~~Refresh token rotation (single-use tokens to limit stolen-token window)~~
```

**Step 2: Run full verification**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

Run: `docker compose exec api uv run pytest`
Expected: All tests pass

Run: `docker compose exec api uv run mypy app/`
Expected: No errors

Run: `docker compose exec api uv run bandit -r app/`
Expected: No new findings

**Step 3: Commit**

```bash
git add docs/roadmap.md
git commit -m "Mark refresh token rotation as done in roadmap"
```
