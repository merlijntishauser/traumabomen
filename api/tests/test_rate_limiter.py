"""Tests for the in-memory login rate limiter."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.rate_limiter import (
    _by_email,
    _by_ip,
    check_and_tarpit,
    clear,
    record_failure,
)


class TestRecordFailure:
    async def test_records_ip_and_email_counters(self):
        record_failure("1.2.3.4", "user@example.com")

        assert "1.2.3.4" in _by_ip
        assert _by_ip["1.2.3.4"].attempts == 1
        assert "user@example.com" in _by_email
        assert _by_email["user@example.com"].attempts == 1

    async def test_increments_on_repeated_failures(self):
        record_failure("1.2.3.4", "user@example.com")
        record_failure("1.2.3.4", "user@example.com")
        record_failure("1.2.3.4", "user@example.com")

        assert _by_ip["1.2.3.4"].attempts == 3
        assert _by_email["user@example.com"].attempts == 3

    async def test_tracks_ip_and_email_separately(self):
        """Different IPs targeting the same email are tracked independently."""
        record_failure("10.0.0.1", "user@example.com")
        record_failure("10.0.0.2", "user@example.com")
        record_failure("10.0.0.3", "user@example.com")

        assert _by_ip["10.0.0.1"].attempts == 1
        assert _by_ip["10.0.0.2"].attempts == 1
        assert _by_ip["10.0.0.3"].attempts == 1
        assert _by_email["user@example.com"].attempts == 3


class TestClear:
    async def test_clear_resets_both_counters(self):
        record_failure("1.2.3.4", "user@example.com")
        record_failure("1.2.3.4", "user@example.com")

        clear("1.2.3.4", "user@example.com")

        assert "1.2.3.4" not in _by_ip
        assert "user@example.com" not in _by_email

    async def test_clear_nonexistent_is_safe(self):
        """Clearing keys that don't exist should not raise."""
        clear("9.9.9.9", "nobody@example.com")


class TestCheckAndTarpit:
    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_no_delay_under_threshold(self, mock_sleep):
        """1-3 failures should not cause any delay."""
        for _ in range(3):
            record_failure("1.2.3.4", "user@example.com")

        await check_and_tarpit("1.2.3.4", "user@example.com")

        mock_sleep.assert_not_called()

    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_tarpit_at_4_failures(self, mock_sleep):
        """4 failures should trigger a 5-second tarpit."""
        for _ in range(4):
            record_failure("1.2.3.4", "user@example.com")

        await check_and_tarpit("1.2.3.4", "user@example.com")

        mock_sleep.assert_called_once_with(5)

    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_tarpit_at_7_failures(self, mock_sleep):
        """7 failures should trigger a 30-second tarpit."""
        for _ in range(7):
            record_failure("1.2.3.4", "user@example.com")

        await check_and_tarpit("1.2.3.4", "user@example.com")

        mock_sleep.assert_called_once_with(30)

    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_lockout_at_10_failures(self, mock_sleep):
        """10 failures should immediately raise 429 with Retry-After header."""
        for _ in range(10):
            record_failure("1.2.3.4", "user@example.com")

        with pytest.raises(HTTPException) as exc_info:
            await check_and_tarpit("1.2.3.4", "user@example.com")

        assert exc_info.value.status_code == 429
        assert exc_info.value.headers["Retry-After"] == "900"
        mock_sleep.assert_not_called()

    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_uses_worse_of_ip_and_email(self, mock_sleep):
        """When email has more failures than IP, the email count drives the tarpit."""
        # Simulate 7 failures from different IPs but the same email
        for i in range(7):
            record_failure(f"10.0.0.{i}", "target@example.com")

        # A brand-new IP checking that email should still tarpit at 30s
        await check_and_tarpit("10.0.0.99", "target@example.com")

        mock_sleep.assert_called_once_with(30)

    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_no_records_means_no_delay(self, mock_sleep):
        """No prior failures should not cause any delay."""
        await check_and_tarpit("5.5.5.5", "clean@example.com")

        mock_sleep.assert_not_called()


class TestCleanup:
    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_old_entries_cleaned_up(self, mock_sleep):
        """Entries older than 30 minutes are evicted during periodic cleanup."""

        record_failure("1.2.3.4", "old@example.com")

        # Age the entries to 31 minutes ago
        aged_time = datetime.now(UTC) - timedelta(minutes=31)
        _by_ip["1.2.3.4"].last_attempt = aged_time
        _by_email["old@example.com"].last_attempt = aged_time

        # Set counter to 99 so the next check triggers cleanup (at 100)
        from app import rate_limiter

        rate_limiter._check_counter = 99

        await check_and_tarpit("1.2.3.4", "old@example.com")

        assert "1.2.3.4" not in _by_ip
        assert "old@example.com" not in _by_email

    @patch("asyncio.sleep", new_callable=AsyncMock)
    async def test_lockout_expires_after_30_min(self, mock_sleep):
        """10 failures aged to 31 minutes should not raise (expired)."""
        from app import rate_limiter

        for _ in range(10):
            record_failure("1.2.3.4", "locked@example.com")

        # Age entries to 31 minutes ago
        aged_time = datetime.now(UTC) - timedelta(minutes=31)
        _by_ip["1.2.3.4"].last_attempt = aged_time
        _by_email["locked@example.com"].last_attempt = aged_time

        # Set counter to 99 so cleanup triggers
        rate_limiter._check_counter = 99

        # Should not raise; the aged entries get cleaned up first
        await check_and_tarpit("1.2.3.4", "locked@example.com")
