import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.guest_links import sweep_expired_guest_links
from app.models.guest_link import GuestLink, GuestLinkNetwork


def _link(tree, user, link_id: str, expires_at: datetime) -> GuestLink:
    return GuestLink(
        id=uuid.uuid4(),
        tree_id=uuid.UUID(tree["id"]),
        owner_id=user.id,
        link_id=link_id,
        token_hash="0" * 64,
        ciphertext="x",
        owner_blob="y",
        expires_at=expires_at,
    )


@pytest.mark.asyncio
async def test_sweep_removes_expired_with_networks_and_keeps_live(db_session, user, tree):
    now = datetime.now(UTC)
    expired = _link(tree, user, "expired" + "a" * 15, now - timedelta(minutes=1))
    live = _link(tree, user, "live" + "b" * 18, now + timedelta(days=1))
    db_session.add_all([expired, live])
    await db_session.flush()
    db_session.add_all(
        [
            GuestLinkNetwork(guest_link_id=expired.id, network_hash="h1"),
            GuestLinkNetwork(guest_link_id=live.id, network_hash="h2"),
        ]
    )
    await db_session.flush()

    assert await sweep_expired_guest_links(db_session) == 1
    await db_session.flush()

    ids = (await db_session.execute(select(GuestLink.id))).scalars().all()
    assert ids == [live.id]
    nets = await db_session.scalar(select(func.count()).select_from(GuestLinkNetwork))
    assert nets == 1
