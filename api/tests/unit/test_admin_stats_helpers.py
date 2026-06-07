"""Unit tests for admin_stats helpers and edge branches."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import Select

from app.routers.admin_stats import (
    _build_user_active_weeks,
    _excluded_user_ids,
    retention_stats,
)


class TestExcludedUserIds:
    def test_without_smoketest_email(self):
        with patch(
            "app.routers.admin_stats.get_settings",
            return_value=SimpleNamespace(SMOKETEST_EMAIL=""),
        ):
            result = _excluded_user_ids()
        assert isinstance(result, Select)

    def test_with_smoketest_email(self):
        with patch(
            "app.routers.admin_stats.get_settings",
            return_value=SimpleNamespace(SMOKETEST_EMAIL="smoke@test.dev"),
        ):
            result = _excluded_user_ids()
        assert isinstance(result, Select)


class TestBuildUserActiveWeeks:
    def test_ignores_logins_for_unknown_users(self):
        users = [SimpleNamespace(id="A", created_at=datetime(2026, 1, 1, tzinfo=UTC))]
        logins = [SimpleNamespace(user_id="B", logged_at=datetime(2026, 1, 15, tzinfo=UTC))]
        assert _build_user_active_weeks(users, logins) == {}


async def test_retention_stats_returns_empty_with_no_users():
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    with patch(
        "app.routers.admin_stats.get_settings",
        return_value=SimpleNamespace(SMOKETEST_EMAIL=""),
    ):
        result = await retention_stats(db=db, weeks=12)
    assert result.cohorts == []
