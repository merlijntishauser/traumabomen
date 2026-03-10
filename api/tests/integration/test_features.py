"""Tests for feature flag endpoints."""

import uuid

import pytest

from app.models.feature_flag import FeatureFlag, FeatureFlagUser
from tests.integration.conftest import auth_headers, create_user


class TestGetFeatures:
    """GET /features - returns flags enabled for the current user."""

    @pytest.mark.asyncio
    async def test_returns_all_flags_disabled_by_default(self, client, headers, db_session):
        """All flags with audience 'disabled' should return False."""
        db_session.add(FeatureFlag(key="test_flag", audience="disabled"))
        await db_session.commit()

        resp = await client.get("/features", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["test_flag"] is False

    @pytest.mark.asyncio
    async def test_all_audience_enabled_for_regular_user(self, client, headers, db_session):
        """Flags with audience 'all' should be True for any user."""
        db_session.add(FeatureFlag(key="public_flag", audience="all"))
        await db_session.commit()

        resp = await client.get("/features", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["public_flag"] is True

    @pytest.mark.asyncio
    async def test_admins_audience_false_for_regular_user(self, client, headers, db_session):
        """Flags with audience 'admins' should be False for non-admin users."""
        db_session.add(FeatureFlag(key="admin_flag", audience="admins"))
        await db_session.commit()

        resp = await client.get("/features", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["admin_flag"] is False

    @pytest.mark.asyncio
    async def test_admins_audience_true_for_admin_user(self, client, admin_headers, db_session):
        """Flags with audience 'admins' should be True for admin users."""
        db_session.add(FeatureFlag(key="admin_flag", audience="admins"))
        await db_session.commit()

        resp = await client.get("/features", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["admin_flag"] is True

    @pytest.mark.asyncio
    async def test_selected_audience_true_for_selected_user(self, client, db_session):
        """Flags with audience 'selected' should be True only for users in the selection."""
        user = await create_user(db_session, email="selected@example.com")
        db_session.add(FeatureFlag(key="beta_flag", audience="selected"))
        db_session.add(FeatureFlagUser(flag_key="beta_flag", user_id=user.id))
        await db_session.commit()

        hdrs = auth_headers(user.id)
        resp = await client.get("/features", headers=hdrs)
        assert resp.status_code == 200
        assert resp.json()["beta_flag"] is True

    @pytest.mark.asyncio
    async def test_selected_audience_false_for_non_selected_user(self, client, headers, db_session):
        """Flags with audience 'selected' should be False for users not in the selection."""
        db_session.add(FeatureFlag(key="beta_flag", audience="selected"))
        await db_session.commit()

        resp = await client.get("/features", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["beta_flag"] is False

    @pytest.mark.asyncio
    async def test_multiple_flags_mixed_audiences(self, client, db_session):
        """Multiple flags with different audiences return correct values."""
        admin = await create_user(db_session, email="multi-admin@example.com", is_admin=True)
        db_session.add(FeatureFlag(key="flag_all", audience="all"))
        db_session.add(FeatureFlag(key="flag_admins", audience="admins"))
        db_session.add(FeatureFlag(key="flag_disabled", audience="disabled"))
        db_session.add(FeatureFlag(key="flag_selected", audience="selected"))
        db_session.add(FeatureFlagUser(flag_key="flag_selected", user_id=admin.id))
        await db_session.commit()

        hdrs = auth_headers(admin.id)
        resp = await client.get("/features", headers=hdrs)
        assert resp.status_code == 200
        data = resp.json()
        assert data["flag_all"] is True
        assert data["flag_admins"] is True
        assert data["flag_disabled"] is False
        assert data["flag_selected"] is True

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, client):
        """Unauthenticated requests should return 401."""
        resp = await client.get("/features")
        assert resp.status_code == 401


class TestAdminGetFeatures:
    """GET /admin/features - returns all flags with detail (admin only)."""

    @pytest.mark.asyncio
    async def test_returns_all_flags_with_detail(self, client, admin_headers, db_session):
        """Admin endpoint returns full flag details including selected user IDs."""
        db_session.add(FeatureFlag(key="flag_a", audience="all"))
        db_session.add(FeatureFlag(key="flag_b", audience="disabled"))
        await db_session.commit()

        resp = await client.get("/admin/features", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        flags = {f["key"]: f for f in data["flags"]}
        assert "flag_a" in flags
        assert flags["flag_a"]["audience"] == "all"
        assert flags["flag_a"]["selected_user_ids"] == []
        assert "flag_b" in flags
        assert flags["flag_b"]["audience"] == "disabled"

    @pytest.mark.asyncio
    async def test_returns_selected_user_ids(self, client, admin_headers, db_session):
        """Selected user IDs are included in the response."""
        user = await create_user(db_session, email="beta@example.com")
        db_session.add(FeatureFlag(key="beta", audience="selected"))
        db_session.add(FeatureFlagUser(flag_key="beta", user_id=user.id))
        await db_session.commit()

        resp = await client.get("/admin/features", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        beta_flag = next(f for f in data["flags"] if f["key"] == "beta")
        assert str(user.id) in beta_flag["selected_user_ids"]

    @pytest.mark.asyncio
    async def test_non_admin_returns_403(self, client, headers):
        """Non-admin users should get 403."""
        resp = await client.get("/admin/features", headers=headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, client):
        """Unauthenticated requests should return 401."""
        resp = await client.get("/admin/features")
        assert resp.status_code == 401


class TestAdminUpdateFeature:
    """PUT /admin/features/{key} - updates a flag (admin only)."""

    @pytest.mark.asyncio
    async def test_update_audience(self, client, admin_headers, db_session):
        """Updating a flag's audience changes it."""
        db_session.add(FeatureFlag(key="toggle", audience="disabled"))
        await db_session.commit()

        resp = await client.put(
            "/admin/features/toggle",
            json={"audience": "all"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["audience"] == "all"
        assert resp.json()["key"] == "toggle"

    @pytest.mark.asyncio
    async def test_update_to_selected_with_user_ids(self, client, admin_headers, db_session):
        """Setting audience to 'selected' with user_ids stores the selection."""
        user = await create_user(db_session, email="pick@example.com")
        db_session.add(FeatureFlag(key="beta", audience="disabled"))
        await db_session.commit()

        resp = await client.put(
            "/admin/features/beta",
            json={"audience": "selected", "user_ids": [str(user.id)]},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["audience"] == "selected"
        assert str(user.id) in data["selected_user_ids"]

    @pytest.mark.asyncio
    async def test_update_clears_old_selected_users(self, client, admin_headers, db_session):
        """Changing audience away from 'selected' clears user selections."""
        user = await create_user(db_session, email="clear@example.com")
        db_session.add(FeatureFlag(key="beta", audience="selected"))
        db_session.add(FeatureFlagUser(flag_key="beta", user_id=user.id))
        await db_session.commit()

        resp = await client.put(
            "/admin/features/beta",
            json={"audience": "all"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["selected_user_ids"] == []

    @pytest.mark.asyncio
    async def test_update_replaces_selected_users(self, client, admin_headers, db_session):
        """Updating selected users replaces the entire set."""
        user1 = await create_user(db_session, email="user1@example.com")
        user2 = await create_user(db_session, email="user2@example.com")
        db_session.add(FeatureFlag(key="beta", audience="selected"))
        db_session.add(FeatureFlagUser(flag_key="beta", user_id=user1.id))
        await db_session.commit()

        resp = await client.put(
            "/admin/features/beta",
            json={"audience": "selected", "user_ids": [str(user2.id)]},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert str(user2.id) in data["selected_user_ids"]
        assert str(user1.id) not in data["selected_user_ids"]

    @pytest.mark.asyncio
    async def test_nonexistent_flag_returns_404(self, client, admin_headers):
        """Updating a flag that does not exist returns 404."""
        resp = await client.put(
            "/admin/features/nonexistent",
            json={"audience": "all"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_audience_returns_422(self, client, admin_headers, db_session):
        """An invalid audience value returns 422."""
        db_session.add(FeatureFlag(key="bad", audience="disabled"))
        await db_session.commit()

        resp = await client.put(
            "/admin/features/bad",
            json={"audience": "invalid_value"},
            headers=admin_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_admin_returns_403(self, client, headers):
        """Non-admin users should get 403."""
        resp = await client.put(
            "/admin/features/anything",
            json={"audience": "all"},
            headers=headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_user_id_returns_422(self, client, admin_headers, db_session):
        """An invalid UUID in user_ids returns 422."""
        db_session.add(FeatureFlag(key="beta", audience="disabled"))
        await db_session.commit()

        resp = await client.put(
            "/admin/features/beta",
            json={"audience": "selected", "user_ids": ["not-a-uuid"]},
            headers=admin_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_nonexistent_user_id_returns_422(self, client, admin_headers, db_session):
        """A valid UUID that does not correspond to an existing user returns 422."""
        db_session.add(FeatureFlag(key="beta", audience="disabled"))
        await db_session.commit()

        fake_id = str(uuid.uuid4())
        resp = await client.put(
            "/admin/features/beta",
            json={"audience": "selected", "user_ids": [fake_id]},
            headers=admin_headers,
        )
        assert resp.status_code == 422
        assert fake_id in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, client):
        """Unauthenticated requests should return 401."""
        resp = await client.put(
            "/admin/features/anything",
            json={"audience": "all"},
        )
        assert resp.status_code == 401
