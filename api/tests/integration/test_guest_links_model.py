"""Tests for GuestLink models: uniqueness and cascade deletes."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError

from app.models.guest_link import GuestLink, GuestLinkNetwork
from app.models.tree import Tree
from app.models.user import User
from tests.integration.conftest import _IS_SQLITE, create_user


@pytest.fixture
async def fk_session(db_session):
    """A session with FK enforcement on, so ON DELETE CASCADE is exercised."""
    if _IS_SQLITE:
        await db_session.execute(text("PRAGMA foreign_keys=ON"))
    yield db_session
    if _IS_SQLITE:
        await db_session.rollback()
        await db_session.execute(text("PRAGMA foreign_keys=OFF"))


def _link(tree, owner, link_id="A" * 22) -> GuestLink:
    return GuestLink(
        tree_id=tree.id,
        owner_id=owner.id,
        link_id=link_id,
        token_hash="0" * 64,
        ciphertext="ct",
        owner_blob="blob",
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )


async def _setup(db):
    owner = await create_user(db, email="owner@example.com")
    tree = Tree(user_id=owner.id, encrypted_data="blob")
    db.add(tree)
    await db.commit()
    link = _link(tree, owner)
    db.add(link)
    await db.commit()
    db.add(GuestLinkNetwork(guest_link_id=link.id, network_hash="f" * 64))
    await db.commit()
    return owner, tree, link


async def _count(db, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar_one()


@pytest.mark.asyncio
async def test_defaults(fk_session):
    _, _, link = await _setup(fk_session)
    await fk_session.refresh(link)
    assert (link.failed_streak, link.failed_total, link.open_count) == (0, 0, 0)
    assert link.last_opened_at is None


@pytest.mark.asyncio
async def test_deleted_with_tree(fk_session):
    _, tree, _ = await _setup(fk_session)
    await fk_session.delete(await fk_session.get(Tree, tree.id))
    await fk_session.commit()
    assert await _count(fk_session, GuestLink) == 0
    assert await _count(fk_session, GuestLinkNetwork) == 0


@pytest.mark.asyncio
async def test_deleted_with_owner(fk_session):
    owner, _, _ = await _setup(fk_session)
    await fk_session.execute(delete(User).where(User.id == owner.id))
    await fk_session.commit()
    assert await _count(fk_session, GuestLink) == 0
    assert await _count(fk_session, GuestLinkNetwork) == 0


@pytest.mark.asyncio
async def test_duplicate_link_id_raises(fk_session):
    owner, tree, _ = await _setup(fk_session)
    fk_session.add(_link(tree, owner))
    with pytest.raises(IntegrityError):
        await fk_session.commit()


@pytest.mark.asyncio
async def test_duplicate_network_raises(fk_session):
    _, _, link = await _setup(fk_session)
    fk_session.add(GuestLinkNetwork(guest_link_id=link.id, network_hash="f" * 64))
    with pytest.raises(IntegrityError):
        await fk_session.commit()
