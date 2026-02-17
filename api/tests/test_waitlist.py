from unittest.mock import patch

import pytest

from tests.conftest import TEST_SETTINGS, create_user


@pytest.mark.asyncio
class TestJoinWaitlist:
    async def test_join_waitlist(self, client):
        resp = await client.post("/waitlist", json={"email": "new@example.com"})
        assert resp.status_code == 201
        assert resp.json()["message"] == "joined_waitlist"

    async def test_join_waitlist_duplicate(self, client):
        await client.post("/waitlist", json={"email": "new@example.com"})
        resp = await client.post("/waitlist", json={"email": "new@example.com"})
        assert resp.status_code == 409
        assert resp.json()["detail"] == "already_on_waitlist"

    async def test_join_waitlist_already_registered_user(self, client, user):
        resp = await client.post("/waitlist", json={"email": "test@example.com"})
        assert resp.status_code == 409
        assert resp.json()["detail"] == "already_registered"

    async def test_join_waitlist_invalid_email(self, client):
        resp = await client.post("/waitlist", json={"email": "not-an-email"})
        assert resp.status_code == 422

    async def test_join_waitlist_normalizes_email(self, client, db_session):
        resp = await client.post("/waitlist", json={"email": "NEW@Example.COM"})
        assert resp.status_code == 201

        from sqlalchemy import select

        from app.models.waitlist import WaitlistEntry

        result = await db_session.execute(select(WaitlistEntry))
        entry = result.scalar_one()
        assert entry.email == "new@example.com"


@pytest.mark.asyncio
class TestAdminWaitlist:
    async def test_list_waitlist(self, client, admin_headers):
        await client.post("/waitlist", json={"email": "a@example.com"})
        await client.post("/waitlist", json={"email": "b@example.com"})

        resp = await client.get("/admin/waitlist", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["waiting"] == 2
        assert data["approved"] == 0
        assert data["registered"] == 0

    async def test_list_waitlist_forbidden_for_non_admin(self, client, headers):
        resp = await client.get("/admin/waitlist", headers=headers)
        assert resp.status_code == 403

    @patch("app.routers.waitlist.send_waitlist_approval_email")
    async def test_approve_waitlist_entry(self, mock_email, client, admin_headers):
        # Join waitlist
        await client.post("/waitlist", json={"email": "new@example.com"})

        # Get entry id
        resp = await client.get("/admin/waitlist", headers=admin_headers)
        entry_id = resp.json()["items"][0]["id"]

        # Approve
        resp = await client.patch(f"/admin/waitlist/{entry_id}/approve", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"
        assert data["approved_at"] is not None

        # Verify email was called (in background thread, but mock catches it)
        mock_email.assert_called_once()
        call_args = mock_email.call_args
        assert call_args[0][0] == "new@example.com"

    async def test_approve_non_waiting_entry(self, client, admin_headers):
        await client.post("/waitlist", json={"email": "new@example.com"})

        resp = await client.get("/admin/waitlist", headers=admin_headers)
        entry_id = resp.json()["items"][0]["id"]

        # Approve once
        with patch("app.routers.waitlist.send_waitlist_approval_email"):
            await client.patch(f"/admin/waitlist/{entry_id}/approve", headers=admin_headers)

        # Try to approve again
        resp = await client.patch(f"/admin/waitlist/{entry_id}/approve", headers=admin_headers)
        assert resp.status_code == 400

    async def test_approve_nonexistent_entry(self, client, admin_headers):
        resp = await client.patch(
            "/admin/waitlist/00000000-0000-0000-0000-000000000000/approve",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    async def test_delete_waitlist_entry(self, client, admin_headers):
        await client.post("/waitlist", json={"email": "new@example.com"})

        resp = await client.get("/admin/waitlist", headers=admin_headers)
        entry_id = resp.json()["items"][0]["id"]

        resp = await client.delete(f"/admin/waitlist/{entry_id}", headers=admin_headers)
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get("/admin/waitlist", headers=admin_headers)
        assert len(resp.json()["items"]) == 0

    async def test_delete_nonexistent_entry(self, client, admin_headers):
        resp = await client.delete(
            "/admin/waitlist/00000000-0000-0000-0000-000000000000",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    async def test_capacity_endpoint(self, client, admin_headers):
        resp = await client.get("/admin/waitlist/capacity", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "active_users" in data
        assert "max_active_users" in data
        assert "waitlist_enabled" in data


@pytest.mark.asyncio
class TestRegistrationWithWaitlist:
    async def test_register_blocked_when_cap_reached(self, client, db_session):
        """When waitlist is enabled and cap reached, registration returns 403."""
        with (
            patch.object(TEST_SETTINGS, "ENABLE_WAITLIST", True),
            patch.object(TEST_SETTINGS, "MAX_ACTIVE_USERS", 1),
        ):
            # Create a verified user to fill the cap
            await create_user(db_session, email="existing@example.com")

            resp = await client.post(
                "/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "password123",
                    "encryption_salt": "test-salt",
                },
            )
            assert resp.status_code == 403
            assert resp.json()["detail"] == "registration_closed"

    async def test_register_allowed_when_under_cap(self, client, db_session):
        """When waitlist is enabled but cap not reached, registration works."""
        with (
            patch.object(TEST_SETTINGS, "ENABLE_WAITLIST", True),
            patch.object(TEST_SETTINGS, "MAX_ACTIVE_USERS", 10),
        ):
            resp = await client.post(
                "/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "password123",
                    "encryption_salt": "test-salt",
                },
            )
            assert resp.status_code == 201

    async def test_register_with_valid_invite_token(self, client, admin_headers, db_session):
        """Registration with valid invite token succeeds even when cap reached."""
        with (
            patch.object(TEST_SETTINGS, "ENABLE_WAITLIST", True),
            patch.object(TEST_SETTINGS, "MAX_ACTIVE_USERS", 1),
        ):
            # Fill cap
            await create_user(db_session, email="existing@example.com")

            # Join waitlist and approve
            await client.post("/waitlist", json={"email": "invited@example.com"})
            resp = await client.get("/admin/waitlist", headers=admin_headers)
            entry_id = resp.json()["items"][0]["id"]

            with patch("app.routers.waitlist.send_waitlist_approval_email") as mock_email:
                resp = await client.patch(
                    f"/admin/waitlist/{entry_id}/approve", headers=admin_headers
                )
                assert resp.status_code == 200
                # Extract token from the email call
                invite_token = mock_email.call_args[0][1]

            # Register with invite token
            resp = await client.post(
                "/auth/register",
                json={
                    "email": "invited@example.com",
                    "password": "password123",
                    "encryption_salt": "test-salt",
                    "invite_token": invite_token,
                },
            )
            assert resp.status_code == 201

            # Verify waitlist entry is now registered
            from sqlalchemy import select

            from app.models.waitlist import WaitlistEntry

            result = await db_session.execute(
                select(WaitlistEntry).where(WaitlistEntry.email == "invited@example.com")
            )
            entry = result.scalar_one()
            assert entry.status == "registered"

    async def test_register_with_invalid_invite_token(self, client):
        resp = await client.post(
            "/auth/register",
            json={
                "email": "new@example.com",
                "password": "password123",
                "encryption_salt": "test-salt",
                "invite_token": "invalid-token",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "invalid_or_expired_invite"

    async def test_register_with_mismatched_email(self, client, admin_headers, db_session):
        """Invite token email must match registration email."""
        # Join waitlist and approve
        await client.post("/waitlist", json={"email": "correct@example.com"})
        resp = await client.get("/admin/waitlist", headers=admin_headers)
        entry_id = resp.json()["items"][0]["id"]

        with patch("app.routers.waitlist.send_waitlist_approval_email") as mock_email:
            await client.patch(f"/admin/waitlist/{entry_id}/approve", headers=admin_headers)
            invite_token = mock_email.call_args[0][1]

        # Try to register with a different email
        resp = await client.post(
            "/auth/register",
            json={
                "email": "wrong@example.com",
                "password": "password123",
                "encryption_salt": "test-salt",
                "invite_token": invite_token,
            },
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "invite_email_mismatch"

    async def test_register_with_expired_invite_token(self, client, admin_headers, db_session):
        """Expired invite tokens are rejected."""
        from datetime import UTC, datetime, timedelta

        from sqlalchemy import select

        from app.models.waitlist import WaitlistEntry

        # Join waitlist and approve
        await client.post("/waitlist", json={"email": "expired@example.com"})
        resp = await client.get("/admin/waitlist", headers=admin_headers)
        entry_id = resp.json()["items"][0]["id"]

        with patch("app.routers.waitlist.send_waitlist_approval_email") as mock_email:
            await client.patch(f"/admin/waitlist/{entry_id}/approve", headers=admin_headers)
            invite_token = mock_email.call_args[0][1]

        # Expire the token manually
        result = await db_session.execute(
            select(WaitlistEntry).where(WaitlistEntry.email == "expired@example.com")
        )
        entry = result.scalar_one()
        entry.invite_expires_at = datetime.now(UTC) - timedelta(days=1)
        await db_session.commit()

        resp = await client.post(
            "/auth/register",
            json={
                "email": "expired@example.com",
                "password": "password123",
                "encryption_salt": "test-salt",
                "invite_token": invite_token,
            },
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "invalid_or_expired_invite"

    async def test_register_allowed_when_max_users_zero(self, client, db_session):
        """MAX_ACTIVE_USERS=0 means unlimited, registration always allowed."""
        with (
            patch.object(TEST_SETTINGS, "ENABLE_WAITLIST", True),
            patch.object(TEST_SETTINGS, "MAX_ACTIVE_USERS", 0),
        ):
            await create_user(db_session, email="existing@example.com")

            resp = await client.post(
                "/auth/register",
                json={
                    "email": "new@example.com",
                    "password": "password123",
                    "encryption_salt": "test-salt",
                },
            )
            assert resp.status_code == 201

    async def test_register_normal_when_waitlist_disabled(self, client):
        """With waitlist disabled, registration works normally without invite."""
        resp = await client.post(
            "/auth/register",
            json={
                "email": "new@example.com",
                "password": "password123",
                "encryption_salt": "test-salt",
            },
        )
        assert resp.status_code == 201
