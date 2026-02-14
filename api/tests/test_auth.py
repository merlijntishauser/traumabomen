"""Tests for auth utilities and auth endpoints."""

import uuid
from unittest.mock import patch

import pytest

from app.auth import create_token, decode_token, hash_password, verify_password
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
        with pytest.raises(Exception):
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
                    json={"email": "verify@example.com", "password": "pass1234", "encryption_salt": "salt"},
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
