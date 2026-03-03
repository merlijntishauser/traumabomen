import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reset_endpoint_truncates_tables(client: AsyncClient, user):
    """POST /test/reset should remove all rows from all tables."""
    resp = await client.post("/test/reset")
    assert resp.status_code == 204

    # Verify user was deleted
    login_resp = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "TestPassword1"},
    )
    assert login_resp.status_code == 401
