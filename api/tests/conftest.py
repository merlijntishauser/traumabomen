"""Shared test fixtures used by both unit and integration tests."""

import pytest


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset rate limiter state between all tests to prevent cross-test pollution."""
    import app.rate_limiter as rl

    rl._by_ip.clear()
    rl._by_email.clear()
    rl._by_endpoint.clear()
    rl._check_counter = 0
    yield
    rl._by_ip.clear()
    rl._by_email.clear()
    rl._by_endpoint.clear()
    rl._check_counter = 0
