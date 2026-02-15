"""Tests for admin stats endpoints and require_admin guard."""

import pytest

from app.models.login_event import LoginEvent
from tests.conftest import create_user

# ---------------------------------------------------------------------------
# Auth guard
# ---------------------------------------------------------------------------


class TestRequireAdmin:
    @pytest.mark.asyncio
    async def test_non_admin_forbidden(self, client, headers):
        resp = await client.get("/admin/stats/overview", headers=headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_rejected(self, client):
        resp = await client.get("/admin/stats/overview")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_allowed(self, client, admin_headers):
        resp = await client.get("/admin/stats/overview", headers=admin_headers)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Admin token includes is_admin claim
# ---------------------------------------------------------------------------


class TestAdminToken:
    @pytest.mark.asyncio
    async def test_admin_token_contains_claim(self, client, db_session):
        """Login as admin user and verify the token works for admin endpoints."""
        await create_user(
            db_session, email="admin-login@example.com", password="pass123", is_admin=True
        )
        login_resp = await client.post(
            "/auth/login", json={"email": "admin-login@example.com", "password": "pass123"}
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        resp = await client.get(
            "/admin/stats/overview", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Overview stats
# ---------------------------------------------------------------------------


class TestOverviewStats:
    @pytest.mark.asyncio
    async def test_overview_empty(self, client, admin_headers):
        """Overview with only the admin user."""
        resp = await client.get("/admin/stats/overview", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_users"] >= 1
        assert "signups" in data
        assert "active_users" in data
        for period in ("day", "week", "month"):
            assert period in data["signups"]
            assert period in data["active_users"]

    @pytest.mark.asyncio
    async def test_overview_counts_signups(self, client, admin_headers, admin_user, db_session):
        """Create a recent user and verify signups count increases."""
        await create_user(db_session, email="recent@example.com")
        resp = await client.get("/admin/stats/overview", headers=admin_headers)
        data = resp.json()
        assert data["total_users"] >= 2
        assert data["signups"]["day"] >= 2  # admin + recent
        assert data["signups"]["month"] >= 2

    @pytest.mark.asyncio
    async def test_overview_counts_active(self, client, admin_headers, admin_user, db_session):
        """Login events appear in active counts."""
        db_session.add(LoginEvent(user_id=admin_user.id))
        await db_session.commit()

        resp = await client.get("/admin/stats/overview", headers=admin_headers)
        data = resp.json()
        assert data["active_users"]["day"] >= 1


# ---------------------------------------------------------------------------
# Retention stats
# ---------------------------------------------------------------------------


class TestRetentionStats:
    @pytest.mark.asyncio
    async def test_retention_empty(self, client, admin_headers):
        resp = await client.get("/admin/stats/retention", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "cohorts" in data

    @pytest.mark.asyncio
    async def test_retention_with_logins(self, client, admin_headers, admin_user, db_session):
        """Admin user with a login event produces a cohort."""
        db_session.add(LoginEvent(user_id=admin_user.id))
        await db_session.commit()

        resp = await client.get("/admin/stats/retention?weeks=4", headers=admin_headers)
        data = resp.json()
        assert len(data["cohorts"]) >= 1
        cohort = data["cohorts"][0]
        assert cohort["signup_count"] >= 1
        assert len(cohort["retention"]) >= 1


# ---------------------------------------------------------------------------
# Usage stats
# ---------------------------------------------------------------------------


class TestUsageStats:
    @pytest.mark.asyncio
    async def test_usage_empty(self, client, admin_headers):
        """No trees at all."""
        resp = await client.get("/admin/stats/usage", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        for key in ("persons", "relationships", "events"):
            assert "zero" in data[key]

    @pytest.mark.asyncio
    async def test_usage_with_data(self, client, admin_headers, headers, tree, person):
        """Tree with one person produces a usage bucket."""
        resp = await client.get("/admin/stats/usage", headers=admin_headers)
        data = resp.json()
        # At least one tree has 1 person -> one_two bucket
        assert data["persons"]["one_two"] >= 1


# ---------------------------------------------------------------------------
# Funnel stats
# ---------------------------------------------------------------------------


class TestFunnelStats:
    @pytest.mark.asyncio
    async def test_funnel_basic(self, client, admin_headers):
        resp = await client.get("/admin/stats/funnel", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["registered"] >= 1
        assert data["verified"] >= 1

    @pytest.mark.asyncio
    async def test_funnel_with_data(self, client, admin_headers, headers, tree, person):
        """User with tree and person appears in funnel stages."""
        resp = await client.get("/admin/stats/funnel", headers=admin_headers)
        data = resp.json()
        assert data["created_tree"] >= 1
        assert data["added_person"] >= 1


# ---------------------------------------------------------------------------
# Activity stats
# ---------------------------------------------------------------------------


class TestActivityStats:
    @pytest.mark.asyncio
    async def test_activity_empty(self, client, admin_headers):
        resp = await client.get("/admin/stats/activity", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "cells" in data

    @pytest.mark.asyncio
    async def test_activity_with_logins(self, client, admin_headers, admin_user, db_session):
        db_session.add(LoginEvent(user_id=admin_user.id))
        await db_session.commit()

        resp = await client.get("/admin/stats/activity", headers=admin_headers)
        data = resp.json()
        assert len(data["cells"]) >= 1
        cell = data["cells"][0]
        assert "day" in cell
        assert "hour" in cell
        assert "count" in cell


# ---------------------------------------------------------------------------
# Growth stats
# ---------------------------------------------------------------------------


class TestGrowthStats:
    @pytest.mark.asyncio
    async def test_growth_basic(self, client, admin_headers):
        resp = await client.get("/admin/stats/growth", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "points" in data
        assert len(data["points"]) >= 1  # admin user signup
        assert data["points"][-1]["total"] >= 1

    @pytest.mark.asyncio
    async def test_growth_cumulative(self, client, admin_headers, db_session):
        """Two users produce cumulative growth."""
        await create_user(db_session, email="growth@example.com")
        resp = await client.get("/admin/stats/growth", headers=admin_headers)
        data = resp.json()
        # Last point should have total >= 2
        assert data["points"][-1]["total"] >= 2


# ---------------------------------------------------------------------------
# User list stats
# ---------------------------------------------------------------------------


class TestUserListStats:
    @pytest.mark.asyncio
    async def test_user_list_basic(self, client, admin_headers, admin_user):
        resp = await client.get("/admin/stats/users", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["users"]) >= 1
        row = data["users"][0]
        assert "id" in row
        assert "email" in row
        assert "created_at" in row
        assert "tree_count" in row

    @pytest.mark.asyncio
    async def test_user_list_with_data(
        self, client, admin_headers, admin_user, headers, tree, person, db_session
    ):
        """User with tree and person shows counts."""
        db_session.add(LoginEvent(user_id=admin_user.id))
        await db_session.commit()

        resp = await client.get("/admin/stats/users", headers=admin_headers)
        data = resp.json()
        assert len(data["users"]) >= 2
        # Find the non-admin user (who has the tree)
        non_admin = [u for u in data["users"] if u["tree_count"] > 0]
        assert len(non_admin) >= 1
        assert non_admin[0]["person_count"] >= 1
