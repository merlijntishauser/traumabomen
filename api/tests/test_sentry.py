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
