"""Unit tests for the waitlist join conflict (race) branch."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.routers.waitlist import join_waitlist


async def test_join_waitlist_conflict_on_integrity_error():
    # Both pre-checks find nothing, but the insert races a concurrent join and
    # the unique constraint fires on commit.
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    db.add = MagicMock()
    db.commit = AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("duplicate")))
    db.rollback = AsyncMock()
    body = SimpleNamespace(email="Race@Example.com")

    with pytest.raises(HTTPException) as exc:
        await join_waitlist(body=body, db=db, settings=SimpleNamespace())

    assert exc.value.status_code == 409
    assert exc.value.detail == "already_on_waitlist"
    db.rollback.assert_awaited_once()
