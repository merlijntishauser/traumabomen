"""Unit tests for auth helper guards and the registration conflict branch."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.routers.auth import (
    _finalize_registration,
    _should_skip_password_reset,
    _was_token_generated_recently,
)


def test_was_token_generated_recently_false_without_expiry():
    user = SimpleNamespace(email_verification_expires_at=None)
    assert _was_token_generated_recently(user) is False


def test_should_skip_password_reset_when_token_recent():
    user = SimpleNamespace(
        email_verified=True,
        password_reset_expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    assert _should_skip_password_reset(user) is True


async def test_finalize_registration_conflict_on_integrity_error():
    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("duplicate")))
    db.rollback = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await _finalize_registration(SimpleNamespace(), None, db)
    assert exc.value.status_code == 409
    db.rollback.assert_awaited_once()
