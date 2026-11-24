import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feature_flag import FeatureFlag
from tests.integration.conftest import create_user


@pytest.mark.asyncio
async def test_reset_deletes_e2e_users(client: AsyncClient, db_session: AsyncSession):
    """POST /test/reset should remove users with e2e- email prefix."""
    e2e_user = await create_user(db_session, email="e2e-1234-1@example.com")
    assert e2e_user.id is not None

    resp = await client.post("/test/reset")
    assert resp.status_code == 204

    login_resp = await client.post(
        "/auth/login",
        json={"email": "e2e-1234-1@example.com", "password": "TestPassword1"},
    )
    assert login_resp.status_code == 401


@pytest.mark.asyncio
async def test_reset_preserves_non_e2e_users(client: AsyncClient, user):
    """POST /test/reset should not remove regular users."""
    resp = await client.post("/test/reset")
    assert resp.status_code == 204

    login_resp = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "TestPassword1"},
    )
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_feature_flag_creates_missing_row(client: AsyncClient, db_session: AsyncSession):
    resp = await client.post("/test/feature-flag", json={"key": "e2e_flag", "audience": "all"})
    assert resp.status_code == 204

    flag = await db_session.get(FeatureFlag, "e2e_flag")
    assert flag is not None
    assert flag.audience == "all"


@pytest.mark.asyncio
async def test_feature_flag_updates_existing_row(client: AsyncClient, db_session: AsyncSession):
    db_session.add(FeatureFlag(key="e2e_flag", audience="disabled"))
    await db_session.commit()

    resp = await client.post("/test/feature-flag", json={"key": "e2e_flag", "audience": "all"})
    assert resp.status_code == 204

    flag = await db_session.get(FeatureFlag, "e2e_flag")
    assert flag is not None
    assert flag.audience == "all"
