"""Integration tests for login rate limiting.

Verifies that the rate limiter is properly wired into the login endpoint:
lockout after 10 failures, counter reset on success, and Retry-After header.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.rate_limiter import _by_email, _by_ip


class TestLoginRateLimiting:
    @pytest.mark.asyncio
    @patch("app.rate_limiter.asyncio.sleep", new_callable=AsyncMock)
    async def test_lockout_after_10_failures(self, mock_sleep, client, user):
        """10 failed logins cause the 11th to return 429."""
        for _ in range(10):
            resp = await client.post(
                "/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )
            assert resp.status_code in (401, 429)

        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    @patch("app.rate_limiter.asyncio.sleep", new_callable=AsyncMock)
    async def test_successful_login_resets_counter(self, mock_sleep, client, user):
        """Fail 5 times, succeed, fail again: counter resets."""
        for _ in range(5):
            await client.post(
                "/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        # Successful login resets counters
        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "TestPassword1"},
        )
        assert resp.status_code == 200

        assert "test@example.com" not in _by_email
        assert "unknown" not in _by_ip

    @pytest.mark.asyncio
    @patch("app.rate_limiter.asyncio.sleep", new_callable=AsyncMock)
    async def test_429_includes_retry_after(self, mock_sleep, client, user):
        """429 response includes Retry-After header."""
        for _ in range(10):
            await client.post(
                "/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert resp.status_code == 429
        assert resp.headers.get("retry-after") == "900"
