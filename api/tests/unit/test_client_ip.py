"""Unit tests for proxy-aware client IP derivation used by rate limiting."""

from types import SimpleNamespace
from unittest.mock import patch

from app.rate_limiter import get_client_ip


def _request(headers: dict[str, str], peer: str | None = "10.0.0.1"):
    client = SimpleNamespace(host=peer) if peer is not None else None
    # Starlette headers are case-insensitive; a plain dict with lowercase keys
    # matches how get_client_ip reads them.
    return SimpleNamespace(headers=headers, client=client)


def test_uses_peer_when_proxy_not_trusted():
    with patch(
        "app.rate_limiter.get_settings", return_value=SimpleNamespace(TRUST_PROXY_HEADERS=False)
    ):
        req = _request({"x-forwarded-for": "1.2.3.4"}, peer="10.0.0.1")
        assert get_client_ip(req) == "10.0.0.1"


def test_uses_leftmost_forwarded_when_proxy_trusted():
    with patch(
        "app.rate_limiter.get_settings", return_value=SimpleNamespace(TRUST_PROXY_HEADERS=True)
    ):
        req = _request({"x-forwarded-for": "1.2.3.4, 10.0.0.2, 10.0.0.1"}, peer="10.0.0.1")
        assert get_client_ip(req) == "1.2.3.4"


def test_falls_back_to_peer_when_trusted_but_no_header():
    with patch(
        "app.rate_limiter.get_settings", return_value=SimpleNamespace(TRUST_PROXY_HEADERS=True)
    ):
        req = _request({}, peer="10.0.0.1")
        assert get_client_ip(req) == "10.0.0.1"


def test_unknown_when_no_peer_and_no_header():
    with patch(
        "app.rate_limiter.get_settings", return_value=SimpleNamespace(TRUST_PROXY_HEADERS=True)
    ):
        req = _request({}, peer=None)
        assert get_client_ip(req) == "unknown"
