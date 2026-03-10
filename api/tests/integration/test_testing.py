import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

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
