"""Tests for Sentry integration (privacy hook and initialization)."""

from app.main import _strip_encrypted_data


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
