"""Tests for auth utilities and auth endpoints."""

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
import pytest

from app.auth import create_token, decode_token, hash_password, verify_password
from app.models.user import User
from tests.conftest import TEST_SETTINGS, auth_headers, create_user

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
            json={"email": "new@example.com", "password": "pass1234", "encryption_salt": "salt"},
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
            json={"email": "test@example.com", "password": "pass1234", "encryption_salt": "salt"},
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
                        "password": "pass1234",
                        "encryption_salt": "salt",
                    },
                )
            assert resp.status_code == 201
            assert resp.json()["message"] == "verification_email_sent"
        finally:
            TEST_SETTINGS.REQUIRE_EMAIL_VERIFICATION = False


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, client, user):
        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "password123"},
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
    async def test_login_unverified_email(self, client, db_session):
        from app.models.user import User

        user = User(
            email="unverified@example.com",
            hashed_password=hash_password("pass123"),
            encryption_salt="salt",
            email_verified=False,
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.post(
            "/auth/login",
            json={"email": "unverified@example.com", "password": "pass123"},
        )
        assert resp.status_code == 403


class TestRefresh:
    @pytest.mark.asyncio
    async def test_refresh_success(self, client, user):
        refresh_token = create_token(user.id, "refresh", TEST_SETTINGS)
        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_fails(self, client, user):
        access_token = create_token(user.id, "access", TEST_SETTINGS)
        resp = await client.post("/auth/refresh", json={"refresh_token": access_token})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client):
        resp = await client.post("/auth/refresh", json={"refresh_token": "invalid"})
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
    async def test_refresh_token_as_access(self, client, user):
        refresh_token = create_token(user.id, "refresh", TEST_SETTINGS)
        resp = await client.get("/trees", headers={"Authorization": f"Bearer {refresh_token}"})
        assert resp.status_code == 401

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
            hashed_password=hash_password("pass123"),
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
            hashed_password=hash_password("pass123"),
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
                hashed_password=hash_password("pass123"),
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
                hashed_password=hash_password("pass123"),
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
            json={"current_password": "password123", "new_password": "newpass456"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Password changed"

        # Verify new password works
        login_resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "newpass456"},
        )
        assert login_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "wrong", "new_password": "newpass"},
            headers=headers,
        )
        assert resp.status_code == 401


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
            content='{"password": "password123"}',
        )
        assert resp.status_code == 204

        # Verify account is gone
        login = await client.post(
            "/auth/login",
            json={"email": "delete-me@example.com", "password": "password123"},
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
        refresh_token = create_token(user.id, "refresh", TEST_SETTINGS)
        await db_session.delete(user)
        await db_session.commit()

        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 401
