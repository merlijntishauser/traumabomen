"""Tests for the TreeShare model: uniqueness and cascade deletes."""

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError

from app.models.tree import Tree
from app.models.tree_share import TreeShare
from app.models.user import User
from tests.integration.conftest import _IS_SQLITE, create_user


@pytest.fixture
async def fk_session(db_session):
    """A session with FK enforcement on, so ON DELETE CASCADE is exercised.

    SQLite ignores foreign keys unless asked; PostgreSQL always enforces them.
    The pragma must run before the connection opens a transaction.
    """
    if _IS_SQLITE:
        await db_session.execute(text("PRAGMA foreign_keys=ON"))
    yield db_session
    if _IS_SQLITE:
        await db_session.rollback()
        await db_session.execute(text("PRAGMA foreign_keys=OFF"))


async def _setup(db):
    owner = await create_user(db, email="owner@example.com")
    recipient = await create_user(db, email="recipient@example.com")
    tree = Tree(user_id=owner.id, encrypted_data="blob")
    db.add(tree)
    await db.commit()
    share = TreeShare(
        tree_id=tree.id,
        owner_id=owner.id,
        recipient_email=recipient.email,
        recipient_id=recipient.id,
    )
    db.add(share)
    await db.commit()
    return owner, recipient, tree, share


async def _share_count(db) -> int:
    return (await db.execute(select(func.count()).select_from(TreeShare))).scalar_one()


@pytest.mark.asyncio
async def test_share_defaults_to_pending(fk_session):
    _, _, _, share = await _setup(fk_session)
    await fk_session.refresh(share)
    assert share.status == "pending"
    assert share.encrypted_tree_key is None


@pytest.mark.asyncio
async def test_share_unique_per_tree_and_email(fk_session):
    owner, recipient, tree, _ = await _setup(fk_session)
    fk_session.add(TreeShare(tree_id=tree.id, owner_id=owner.id, recipient_email=recipient.email))
    with pytest.raises(IntegrityError):
        await fk_session.commit()


@pytest.mark.asyncio
async def test_share_deleted_with_tree(fk_session):
    _, _, tree, _ = await _setup(fk_session)
    await fk_session.delete(await fk_session.get(Tree, tree.id))
    await fk_session.commit()
    assert await _share_count(fk_session) == 0


@pytest.mark.asyncio
async def test_share_deleted_with_recipient_account(fk_session):
    _, recipient, _, _ = await _setup(fk_session)
    await fk_session.execute(delete(User).where(User.id == recipient.id))
    await fk_session.commit()
    assert await _share_count(fk_session) == 0


@pytest.mark.asyncio
async def test_share_deleted_with_owner_account(fk_session):
    owner, _, _, _ = await _setup(fk_session)
    await fk_session.execute(delete(User).where(User.id == owner.id))
    await fk_session.commit()
    assert await _share_count(fk_session) == 0
