"""Tests for auth utilities and auth endpoints."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
import pytest
from sqlalchemy import select, update

from app.auth import (
    check_password_strength,
    create_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from tests.integration.conftest import (
    TEST_SETTINGS,
    auth_headers,
    create_test_refresh_token,
    create_user,
)

# ---------------------------------------------------------------------------
# Unit tests: auth utilities
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("my-secret")
        assert verify_password("my-secret", hashed)

    def test_wrong_password(self):
        hashed = hash_password("my-secret")
        assert not verify_password("wrong", hashed)

    def test_hash_is_unique(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # different salts


class TestPasswordStrength:
    def test_empty_password_is_weak(self):
        result = check_password_strength("")
        assert result["level"] == "weak"
        assert result["score"] == 0

    def test_short_password_is_weak(self):
        result = check_password_strength("short")
        assert result["level"] == "weak"
        assert result["score"] == 0

    def test_8_chars_single_case_is_weak(self):
        result = check_password_strength("abcdefgh")
        assert result["level"] == "weak"
        assert result["score"] == 1

    def test_8_chars_mixed_case_is_weak(self):
        result = check_password_strength("Abcdefgh")
        assert result["level"] == "weak"
        assert result["score"] == 2

    def test_12_chars_single_case_is_weak(self):
        result = check_password_strength("abcdefghijkl")
        assert result["level"] == "weak"
        assert result["score"] == 2

    def test_8_chars_mixed_case_digit_is_fair(self):
        result = check_password_strength("Abcdefg1")
        assert result["level"] == "fair"
        assert result["score"] == 3

    def test_12_chars_mixed_case_is_fair(self):
        result = check_password_strength("Abcdefghijkl")
        assert result["level"] == "fair"
        assert result["score"] == 3

    def test_16_chars_single_case_is_fair(self):
        result = check_password_strength("a" * 16)
        assert result["level"] == "fair"
        assert result["score"] == 3

    def test_16_chars_mixed_case_digit_is_max(self):
        result = check_password_strength("Abcdefghijklmno1")
        assert result["level"] == "strong"
        assert result["score"] == 5

    def test_symbols_count_as_digit_or_symbol(self):
        result = check_password_strength("abcdefg!")
        assert result["score"] == 2


class TestRefreshTokenFunctions:
    @pytest.mark.asyncio
    async def test_create_refresh_token_returns_plaintext_and_stores_hash(self, db_session):
        from app.auth import create_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        assert len(plaintext) > 20

        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        result = await db_session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
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

        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
        res = await db_session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        assert res.scalar_one().revoked is True

    @pytest.mark.asyncio
    async def test_use_revoked_token_revokes_entire_family(self, db_session):
        from app.auth import create_refresh_token, use_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        token1 = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        await use_refresh_token(token1, db_session)
        token2 = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        result = await use_refresh_token(token1, db_session)
        assert result is None

        token2_hash = hashlib.sha256(token2.encode()).hexdigest()
        res = await db_session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token2_hash)
        )
        assert res.scalar_one().revoked is True

    @pytest.mark.asyncio
    async def test_use_expired_token_returns_none(self, db_session):
        from app.auth import create_refresh_token, use_refresh_token
        from app.models.refresh_token import RefreshToken

        user = await create_user(db_session)
        family_id = uuid.uuid4()
        plaintext = await create_refresh_token(user.id, family_id, db_session, TEST_SETTINGS)

        token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
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
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
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


class TestTokens:
    def test_create_and_decode_access(self):
        uid = uuid.uuid4()
        token = create_token(uid, "access", TEST_SETTINGS)
        payload = decode_token(token, TEST_SETTINGS)
        assert payload["sub"] == str(uid)
        assert payload["type"] == "access"

    def test_create_and_decode_refresh(self):
        uid = uuid.uuid4()
        token = create_token(uid, "refresh", TEST_SETTINGS)
        payload = decode_token(token, TEST_SETTINGS)
        assert payload["type"] == "refresh"

    def test_invalid_token_raises(self):
        with pytest.raises(jwt.PyJWTError):
            decode_token("garbage", TEST_SETTINGS)


# ---------------------------------------------------------------------------
# Integration tests: auth endpoints
# ---------------------------------------------------------------------------


class TestRegister:
    @pytest.mark.asyncio
    async def test_register_success(self, client):
        resp = await client.post(
            "/auth/register",
            json={
                "email": "new@example.com",
                "password": "TestPassword1",
                "encryption_salt": "salt",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["encryption_salt"] == "salt"

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client, user):
        resp = await client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "TestPassword1",
                "encryption_salt": "salt",
            },
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_register_with_verification(self, client):
        TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = True
        try:
            with patch("app.routers.auth.send_verification_email"):
                resp = await client.post(
                    "/auth/register",
                    json={
                        "email": "verify@example.com",
                        "password": "TestPassword1",
                        "encryption_salt": "salt",
                    },
                )
            assert resp.status_code == 201
            assert resp.json()["message"] == "verification_email_sent"
        finally:
            TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = False

    @pytest.mark.asyncio
    async def test_register_weak_password_rejected(self, client):
        resp = await client.post(
            "/auth/register",
            json={"email": "weak@example.com", "password": "abc", "encryption_salt": "salt"},
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_weak"

    @pytest.mark.asyncio
    async def test_register_too_long_password_rejected(self, client):
        resp = await client.post(
            "/auth/register",
            json={"email": "long@example.com", "password": "a" * 65, "encryption_salt": "salt"},
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_long"


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, client, user):
        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "TestPassword1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["encryption_salt"] == "test-salt-abc"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client, user):
        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        resp = await client.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": "pass"},
        )
        assert resp.status_code == 401

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

    @pytest.mark.asyncio
    async def test_login_unverified_email(self, client, db_session):
        from app.models.user import User

        user = User(
            email="unverified@example.com",
            hashed_password=hash_password("TestPassword1"),
            encryption_salt="salt",
            email_verified=False,
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.post(
            "/auth/login",
            json={"email": "unverified@example.com", "password": "TestPassword1"},
        )
        assert resp.status_code == 403


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


class TestSalt:
    @pytest.mark.asyncio
    async def test_get_salt(self, client, user, headers):
        resp = await client.get("/auth/salt", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["encryption_salt"] == "test-salt-abc"

    @pytest.mark.asyncio
    async def test_get_salt_unauthenticated(self, client):
        resp = await client.get("/auth/salt")
        assert resp.status_code == 401


class TestProtectedEndpoint:
    @pytest.mark.asyncio
    async def test_invalid_token(self, client):
        resp = await client.get("/trees", headers={"Authorization": "Bearer garbage"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_opaque_refresh_token_as_access(self, client, db_session):
        user = await create_user(db_session, email="opaque@example.com")
        refresh_token = await create_test_refresh_token(db_session, user.id)
        resp = await client.get("/trees", headers={"Authorization": f"Bearer {refresh_token}"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_jwt_refresh_token_rejected_as_access(self, client, db_session):
        user = await create_user(db_session, email="jwt-refresh@example.com")
        refresh_jwt = create_token(user.id, "refresh", TEST_SETTINGS)
        resp = await client.get("/trees", headers={"Authorization": f"Bearer {refresh_jwt}"})
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid token type"

    @pytest.mark.asyncio
    async def test_nonexistent_user_token(self, client):
        fake_id = uuid.uuid4()
        headers = auth_headers(fake_id)
        resp = await client.get("/trees", headers=headers)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------


def _utcnow_naive() -> datetime:
    """Return current UTC time as a naive datetime (for SQLite compat)."""
    return datetime.now(UTC).replace(tzinfo=None)


class TestVerifyEmail:
    @pytest.mark.asyncio
    async def test_verify_valid_token(self, client, db_session):
        """Register with verification, then verify the token."""
        token = "test-verify-token-abc123"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        user = User(
            email="verify-test@example.com",
            hashed_password=hash_password("TestPassword1"),
            encryption_salt="salt",
            email_verified=False,
            email_verification_token=token_hash,
            email_verification_expires_at=_utcnow_naive() + timedelta(hours=24),
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 200
        assert resp.json()["message"] == "email_verified"

    @pytest.mark.asyncio
    async def test_verify_invalid_token(self, client):
        resp = await client.get("/auth/verify?token=invalid-token")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_verify_expired_token(self, client, db_session):
        token = "expired-token-xyz"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        user = User(
            email="expired@example.com",
            hashed_password=hash_password("TestPassword1"),
            encryption_salt="salt",
            email_verified=False,
            email_verification_token=token_hash,
            email_verification_expires_at=_utcnow_naive() - timedelta(hours=1),
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.get(f"/auth/verify?token={token}")
        assert resp.status_code == 400


class TestResendVerification:
    @pytest.mark.asyncio
    async def test_resend_disabled(self, client):
        """Resend when verification is not enabled returns 400."""
        resp = await client.post("/auth/resend-verification", json={"email": "test@example.com"})
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_resend_success(self, client, db_session):
        """Resend for an unverified user with an old token sends a new email."""
        TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = True
        try:
            user = User(
                email="resend@example.com",
                hashed_password=hash_password("TestPassword1"),
                encryption_salt="salt",
                email_verified=False,
                email_verification_token="old-hash",
                email_verification_expires_at=_utcnow_naive() + timedelta(hours=12),
            )
            db_session.add(user)
            await db_session.commit()

            with patch("app.routers.auth.send_verification_email"):
                resp = await client.post(
                    "/auth/resend-verification", json={"email": "resend@example.com"}
                )
            assert resp.status_code == 200
            assert resp.json()["message"] == "verification_email_sent"
        finally:
            TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = False

    @pytest.mark.asyncio
    async def test_resend_unknown_email(self, client):
        """Unknown email still returns success to prevent enumeration."""
        TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = True
        try:
            resp = await client.post(
                "/auth/resend-verification", json={"email": "unknown@example.com"}
            )
            assert resp.status_code == 200
            assert resp.json()["message"] == "verification_email_sent"
        finally:
            TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = False

    @pytest.mark.asyncio
    async def test_resend_already_verified(self, client, user):
        """Already-verified user returns success silently."""
        TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = True
        try:
            resp = await client.post(
                "/auth/resend-verification", json={"email": "test@example.com"}
            )
            assert resp.status_code == 200
        finally:
            TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = False

    @pytest.mark.asyncio
    async def test_resend_rate_limited(self, client, db_session):
        """Resend too soon after last send returns 429."""
        TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = True
        try:
            user = User(
                email="ratelimit@example.com",
                hashed_password=hash_password("TestPassword1"),
                encryption_salt="salt",
                email_verified=False,
                email_verification_token="hash",
                # Token generated just now (expires in ~24h, which is > 23h from now)
                email_verification_expires_at=_utcnow_naive() + timedelta(hours=24),
            )
            db_session.add(user)
            await db_session.commit()

            resp = await client.post(
                "/auth/resend-verification", json={"email": "ratelimit@example.com"}
            )
            assert resp.status_code == 429
        finally:
            TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = False


# ---------------------------------------------------------------------------
# Password & salt management
# ---------------------------------------------------------------------------


class TestChangePassword:
    @pytest.mark.asyncio
    async def test_change_password_success(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "TestPassword1", "new_password": "NewTestPass456"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Password changed"

        # Verify new password works
        login_resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "NewTestPass456"},
        )
        assert login_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "wrong", "new_password": "NewTestPass456"},
            headers=headers,
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_weak_rejected(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "TestPassword1", "new_password": "weak"},
            headers=headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_weak"

    @pytest.mark.asyncio
    async def test_change_password_too_long_rejected(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "TestPassword1", "new_password": "a" * 65},
            headers=headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_long"


class TestUpdateSalt:
    @pytest.mark.asyncio
    async def test_update_salt(self, client, user, headers):
        resp = await client.put(
            "/auth/salt",
            json={"encryption_salt": "new-salt-xyz"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Salt updated"

        # Verify the salt was updated
        salt_resp = await client.get("/auth/salt", headers=headers)
        assert salt_resp.json()["encryption_salt"] == "new-salt-xyz"


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------


class TestDeleteAccount:
    @pytest.mark.asyncio
    async def test_delete_account_success(self, client, db_session):
        user = await create_user(db_session, email="delete-me@example.com")
        hdrs = auth_headers(user.id)
        hdrs["Content-Type"] = "application/json"
        resp = await client.request(
            "DELETE",
            "/auth/account",
            headers=hdrs,
            content='{"password": "TestPassword1"}',
        )
        assert resp.status_code == 204

        # Verify account is gone
        login = await client.post(
            "/auth/login",
            json={"email": "delete-me@example.com", "password": "TestPassword1"},
        )
        assert login.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_account_wrong_password(self, client, user, headers):
        headers["Content-Type"] = "application/json"
        resp = await client.request(
            "DELETE",
            "/auth/account",
            headers=headers,
            content='{"password": "wrong"}',
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Refresh edge case: deleted user
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Onboarding safety acknowledgement
# ---------------------------------------------------------------------------


class TestAcknowledgeOnboarding:
    @pytest.mark.asyncio
    async def test_acknowledge_onboarding_success(self, client, user, headers):
        """Authenticated user can acknowledge the onboarding safety gate."""
        resp = await client.put("/auth/onboarding", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Onboarding acknowledged"

    @pytest.mark.asyncio
    async def test_acknowledge_onboarding_unauthenticated(self, client):
        """Unauthenticated request returns 401."""
        resp = await client.put("/auth/onboarding")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_acknowledge_persists_across_login(self, client, user, headers):
        """After acknowledging, subsequent login returns True."""
        resp = await client.put("/auth/onboarding", headers=headers)
        assert resp.status_code == 200

        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "TestPassword1"},
        )
        assert resp.status_code == 200
        assert resp.json()["onboarding_safety_acknowledged"] is True

    @pytest.mark.asyncio
    async def test_onboarding_flag_in_login_response(self, client, user):
        """Login response includes onboarding_safety_acknowledged (False for new user)."""
        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "TestPassword1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "onboarding_safety_acknowledged" in data
        assert data["onboarding_safety_acknowledged"] is False

    @pytest.mark.asyncio
    async def test_onboarding_flag_in_register_response(self, client):
        """Register response includes onboarding_safety_acknowledged as False."""
        resp = await client.post(
            "/auth/register",
            json={
                "email": "onboard@example.com",
                "password": "TestPassword1",
                "encryption_salt": "salt",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "onboarding_safety_acknowledged" in data
        assert data["onboarding_safety_acknowledged"] is False


# ---------------------------------------------------------------------------
# Passphrase hint
# ---------------------------------------------------------------------------


class TestPassphraseHint:
    """Tests for passphrase hint feature."""

    @pytest.mark.asyncio
    async def test_register_with_hint(self, client, db_session):
        """Register with optional passphrase_hint stores it."""
        response = await client.post(
            "/auth/register",
            json={
                "email": "hint-user@example.com",
                "password": "StrongPass123!",
                "encryption_salt": "test-salt",
                "passphrase_hint": "My favorite book title",
            },
        )
        assert response.status_code == 201
        # Verify hint is returned in salt endpoint
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        salt_resp = await client.get("/auth/salt", headers=headers)
        assert salt_resp.json()["passphrase_hint"] == "My favorite book title"

    @pytest.mark.asyncio
    async def test_register_without_hint(self, client, db_session):
        """Register without hint stores null."""
        response = await client.post(
            "/auth/register",
            json={
                "email": "nohint@example.com",
                "password": "StrongPass123!",
                "encryption_salt": "test-salt",
            },
        )
        assert response.status_code == 201
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        salt_resp = await client.get("/auth/salt", headers=headers)
        assert salt_resp.json()["passphrase_hint"] is None

    @pytest.mark.asyncio
    async def test_salt_returns_hint(self, client, headers, user, db_session):
        """GET /auth/salt includes passphrase_hint field."""
        response = await client.get("/auth/salt", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "passphrase_hint" in data
        assert "encryption_salt" in data

    @pytest.mark.asyncio
    async def test_update_hint(self, client, headers, db_session):
        """PUT /auth/hint updates the hint."""
        response = await client.put(
            "/auth/hint",
            headers=headers,
            json={"passphrase_hint": "First pet name"},
        )
        assert response.status_code == 200
        # Verify persisted
        salt_resp = await client.get("/auth/salt", headers=headers)
        assert salt_resp.json()["passphrase_hint"] == "First pet name"

    @pytest.mark.asyncio
    async def test_clear_hint(self, client, headers, db_session):
        """PUT /auth/hint with null clears the hint."""
        # Set a hint first
        await client.put(
            "/auth/hint",
            headers=headers,
            json={"passphrase_hint": "Temporary hint"},
        )
        # Clear it
        response = await client.put(
            "/auth/hint",
            headers=headers,
            json={"passphrase_hint": None},
        )
        assert response.status_code == 200
        salt_resp = await client.get("/auth/salt", headers=headers)
        assert salt_resp.json()["passphrase_hint"] is None

    @pytest.mark.asyncio
    async def test_update_hint_unauthenticated(self, client):
        """PUT /auth/hint requires authentication."""
        response = await client.put(
            "/auth/hint",
            json={"passphrase_hint": "Nope"},
        )
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_hint_max_length(self, client, headers, db_session):
        """PUT /auth/hint rejects hints over 255 characters."""
        response = await client.put(
            "/auth/hint",
            headers=headers,
            json={"passphrase_hint": "x" * 256},
        )
        assert response.status_code == 422
