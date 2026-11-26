"""Tests for Sentry integration (privacy hook and initialization)."""

import pytest

from app.main import _strip_encrypted_data, _strip_transaction


@pytest.mark.parametrize("hook", [_strip_encrypted_data, _strip_transaction])
@pytest.mark.parametrize("name", ["X-Proxy-Secret", "x-proxy-secret", "X-PROXY-SECRET"])
def test_proxy_secret_header_removed(hook, name):
    event = {
        "request": {
            "headers": {name: "s3cret", "X-Real-IP": "1.2.3.4", "Host": "x"},
            "data": {"encrypted_data": "blob"},
        }
    }
    result = hook(event, {})
    assert [k for k in result["request"]["headers"] if k.lower() == "x-proxy-secret"] == []
    assert result["request"]["headers"]["Host"] == "x"
    assert result["request"]["data"]["encrypted_data"] == "[filtered]"


def _guest_event(**extra):
    event = {
        "request": {
            "url": "https://api.example.org/guest/open?x=1",
            "headers": {"X-Real-IP": "1.2.3.4", "User-Agent": "ua"},
            "env": {"REMOTE_ADDR": "1.2.3.4"},
            "data": {"encrypted_data": "blob"},
        },
        "user": {"ip_address": "1.2.3.4"},
        "client_ip": "1.2.3.4",
    }
    event.update(extra)
    return event


@pytest.mark.parametrize("hook", [_strip_encrypted_data, _strip_transaction])
def test_guest_events_lose_headers_env_user_and_client_ip(hook):
    result = hook(_guest_event(), {})
    assert "headers" not in result["request"]
    assert "env" not in result["request"]
    assert "user" not in result
    assert "client_ip" not in result
    assert result["request"]["data"]["encrypted_data"] == "[filtered]"


@pytest.mark.parametrize("hook", [_strip_encrypted_data, _strip_transaction])
def test_guest_transaction_name_is_enough_when_url_is_missing(hook):
    event = {"transaction": "/guest/open", "request": {"headers": {"a": "b"}}, "user": {"id": 1}}
    result = hook(event, {})
    assert "headers" not in result["request"]
    assert "user" not in result


@pytest.mark.parametrize("hook", [_strip_encrypted_data, _strip_transaction])
def test_other_events_keep_headers_and_user(hook):
    event = _guest_event()
    event["request"]["url"] = "https://api.example.org/guests"
    result = hook(event, {})
    assert result["request"]["headers"]["User-Agent"] == "ua"
    assert result["user"] == {"ip_address": "1.2.3.4"}


def test_events_without_headers_pass_through():
    event = {"request": {"url": "/health"}}
    assert _strip_transaction(event, {}) == {"request": {"url": "/health"}}


class TestStripEncryptedData:
    def test_filters_encrypted_data_keys(self):
        event = {
            "request": {
                "data": {
                    "encrypted_data": "secret-blob",
                    "encrypted_name": "cipher-name",
                    "tree_id": "abc-123",
                }
            }
        }
        result = _strip_encrypted_data(event, {})
        assert result["request"]["data"]["encrypted_data"] == "[filtered]"
        assert result["request"]["data"]["encrypted_name"] == "[filtered]"
        assert result["request"]["data"]["tree_id"] == "abc-123"

    def test_passes_through_events_without_request(self):
        event = {"exception": {"values": [{"type": "ValueError"}]}}
        result = _strip_encrypted_data(event, {})
        assert result == event

    def test_passes_through_events_with_non_dict_data(self):
        event = {"request": {"data": "raw-body-string"}}
        result = _strip_encrypted_data(event, {})
        assert result["request"]["data"] == "raw-body-string"

    def test_passes_through_events_without_data(self):
        event = {"request": {"url": "/health"}}
        result = _strip_encrypted_data(event, {})
        assert result == event

    def test_case_insensitive_key_matching(self):
        event = {"request": {"data": {"Encrypted_Data": "blob", "ENCRYPTED_FIELD": "blob2"}}}
        result = _strip_encrypted_data(event, {})
        assert result["request"]["data"]["Encrypted_Data"] == "[filtered]"
        assert result["request"]["data"]["ENCRYPTED_FIELD"] == "[filtered]"

    def test_filters_nested_encrypted_keys(self):
        event = {
            "request": {
                "data": {
                    "trees": [
                        {
                            "tree_id": "t1",
                            "encrypted_data": "secret",
                            "persons": [{"id": "p1", "encrypted_data": "nested-secret"}],
                        }
                    ]
                }
            }
        }
        result = _strip_encrypted_data(event, {})
        tree = result["request"]["data"]["trees"][0]
        assert tree["encrypted_data"] == "[filtered]"
        assert tree["tree_id"] == "t1"
        assert tree["persons"][0]["encrypted_data"] == "[filtered]"
        assert tree["persons"][0]["id"] == "p1"

    def test_filters_deeply_nested_dicts(self):
        event = {
            "request": {
                "data": {"outer": {"inner": {"encrypted_key_ring": "deep-secret", "normal": "ok"}}}
            }
        }
        result = _strip_encrypted_data(event, {})
        assert result["request"]["data"]["outer"]["inner"]["encrypted_key_ring"] == "[filtered]"
        assert result["request"]["data"]["outer"]["inner"]["normal"] == "ok"
