import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feature_flag import FeatureFlag
from app.models.guest_link import GuestLink
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


@pytest.mark.asyncio
async def test_guest_link_expire_moves_expiry_into_the_past(
    client: AsyncClient, db_session: AsyncSession, user, tree
):
    db_session.add(
        GuestLink(
            tree_id=uuid.UUID(tree["id"]),
            owner_id=user.id,
            link_id="L" * 22,
            token_hash="0" * 64,
            ciphertext="the-ciphertext",
            owner_blob="blob",
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
    )
    await db_session.commit()

    resp = await client.post("/test/guest-link-expire", json={"link_id": "L" * 22})
    assert resp.status_code == 204

    db_session.expire_all()
    link = (
        await db_session.execute(select(GuestLink).where(GuestLink.link_id == "L" * 22))
    ).scalar_one()
    expires_at = link.expires_at
    if expires_at.tzinfo is None:  # SQLite drops the zone
        expires_at = expires_at.replace(tzinfo=UTC)
    assert expires_at <= datetime.now(UTC)


@pytest.mark.asyncio
async def test_guest_link_expire_unknown_link_is_404(client: AsyncClient):
    resp = await client.post("/test/guest-link-expire", json={"link_id": "U" * 22})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_guest_open_limit_reset_clears_only_guest_open_counts(client: AsyncClient):
    import app.rate_limiter as rl

    for _ in range(rl.ENDPOINT_RATE_LIMIT):
        rl.check_endpoint_rate_limit("203.0.113.9", "guest-open")
    rl.check_endpoint_rate_limit("203.0.113.9", "tree-share")

    resp = await client.post("/test/guest-open-limit-reset")
    assert resp.status_code == 204

    assert "203.0.113.9:guest-open" not in rl._by_endpoint
    assert rl._by_endpoint["203.0.113.9:tree-share"].attempts == 1
    # A full window's worth of opens is allowed again.
    for _ in range(rl.ENDPOINT_RATE_LIMIT):
        rl.check_endpoint_rate_limit("203.0.113.9", "guest-open")
