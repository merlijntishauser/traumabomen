"""Unit tests for proxy-aware client IP derivation used by rate limiting."""

import logging
from types import SimpleNamespace
from unittest.mock import patch

import app.rate_limiter as rl
from app.rate_limiter import get_client_address, get_client_ip


def _settings(trust=False, secret="", previous=""):
    return SimpleNamespace(
        TRUST_PROXY_HEADERS=trust,
        PROXY_SHARED_SECRET=secret,
        PROXY_SHARED_SECRET_PREVIOUS=previous,
    )


def _request(headers: dict[str, str], peer: str | None = "10.0.0.1"):
    client = SimpleNamespace(host=peer) if peer is not None else None
    # Starlette headers are case-insensitive; a plain dict with lowercase keys
    # matches how get_client_ip reads them.
    return SimpleNamespace(headers=headers, client=client)


def test_uses_peer_when_proxy_not_trusted():
    with patch("app.rate_limiter.get_settings", return_value=_settings(trust=False)):
        req = _request({"x-forwarded-for": "1.2.3.4"}, peer="10.0.0.1")
        assert get_client_ip(req) == "10.0.0.1"


def test_uses_leftmost_forwarded_when_proxy_trusted():
    with patch("app.rate_limiter.get_settings", return_value=_settings(trust=True)):
        req = _request({"x-forwarded-for": "1.2.3.4, 10.0.0.2, 10.0.0.1"}, peer="10.0.0.1")
        assert get_client_ip(req) == "1.2.3.4"


def test_falls_back_to_peer_when_trusted_but_no_header():
    with patch("app.rate_limiter.get_settings", return_value=_settings(trust=True)):
        req = _request({}, peer="10.0.0.1")
        assert get_client_ip(req) == "10.0.0.1"


def test_unknown_when_no_peer_and_no_header():
    with patch("app.rate_limiter.get_settings", return_value=_settings(trust=True)):
        req = _request({}, peer=None)
        assert get_client_ip(req) == "unknown"


def _verified_req(**extra):
    headers = {"x-proxy-secret": "current", "x-real-ip": "203.0.113.9"}
    headers.update(extra)
    return _request(headers)


def test_verified_with_current_secret():
    with patch("app.rate_limiter.get_settings", return_value=_settings(secret="current")):
        addr = get_client_address(_verified_req())
        assert addr == ("203.0.113.9", True)


def test_verified_with_previous_secret():
    with patch(
        "app.rate_limiter.get_settings",
        return_value=_settings(secret="new", previous="current"),
    ):
        assert get_client_address(_verified_req()).verified is True


def test_verified_ip_ignores_forwarded_for():
    with patch("app.rate_limiter.get_settings", return_value=_settings(secret="current")):
        req = _verified_req(**{"x-forwarded-for": "9.9.9.9, 8.8.8.8"})
        assert get_client_address(req).ip == "203.0.113.9"


def test_unverified_when_secret_wrong_missing_or_empty():
    with patch("app.rate_limiter.get_settings", return_value=_settings(secret="current")):
        for headers in (
            {"x-real-ip": "203.0.113.9"},
            {"x-real-ip": "203.0.113.9", "x-proxy-secret": "nope"},
            {"x-real-ip": "203.0.113.9", "x-proxy-secret": ""},
        ):
            addr = get_client_address(_request(headers))
            assert addr == ("10.0.0.1", False)


def test_empty_header_never_matches_empty_secret():
    with patch("app.rate_limiter.get_settings", return_value=_settings(secret="")):
        req = _request({"x-proxy-secret": "", "x-real-ip": "203.0.113.9"})
        assert get_client_address(req) == ("10.0.0.1", False)


def test_unverified_when_real_ip_invalid():
    with patch("app.rate_limiter.get_settings", return_value=_settings(secret="current")):
        req = _verified_req(**{"x-real-ip": "not-an-ip"})
        assert get_client_address(req).verified is False


def test_unverified_falls_back_to_leftmost_forwarded_never_rightmost():
    with patch("app.rate_limiter.get_settings", return_value=_settings(trust=True)):
        req = _request({"x-forwarded-for": "1.2.3.4, 5.6.7.8"})
        assert get_client_address(req) == ("1.2.3.4", False)


def test_unverified_warning_has_no_address_and_is_throttled(caplog):
    rl._last_unverified_warning = None
    with (
        patch("app.rate_limiter.get_settings", return_value=_settings(trust=True)),
        caplog.at_level(logging.WARNING, logger="app.rate_limiter"),
    ):
        req = _request({"x-forwarded-for": "1.2.3.4"})
        get_client_address(req)
        get_client_address(req)
    records = [r for r in caplog.records if "proxy secret" in r.getMessage()]
    assert len(records) == 1
    assert "1.2.3.4" not in records[0].getMessage()
    assert "10.0.0.1" not in records[0].getMessage()
