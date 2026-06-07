"""Unit tests for app.main helpers (health-check log filter, Sentry init)."""

import logging
from types import SimpleNamespace
from unittest.mock import patch

from app.main import _HealthCheckLogFilter, _init_sentry


def _record(args):
    return logging.LogRecord("uvicorn.access", logging.INFO, __file__, 0, "%s %s %s", args, None)


class TestHealthCheckLogFilter:
    def test_drops_health_check_records(self):
        record = _record(("127.0.0.1:1", "GET", "/health", "1.1", 200))
        assert _HealthCheckLogFilter().filter(record) is False

    def test_keeps_other_paths(self):
        record = _record(("127.0.0.1:1", "GET", "/trees", "1.1", 200))
        assert _HealthCheckLogFilter().filter(record) is True

    def test_keeps_records_with_short_arg_tuples(self):
        record = _record(("127.0.0.1:1", "GET"))
        assert _HealthCheckLogFilter().filter(record) is True


class TestInitSentry:
    def test_skips_when_no_dsn(self):
        with patch("app.main.sentry_sdk.init") as mock_init:
            _init_sentry(SimpleNamespace(SENTRY_DSN=None))
        mock_init.assert_not_called()

    def test_initialises_when_dsn_present(self):
        settings = SimpleNamespace(
            SENTRY_DSN="https://key@o0.ingest.sentry.io/1",
            SENTRY_ENVIRONMENT="test",
            SENTRY_RELEASE="rel-1",
        )
        with patch("app.main.sentry_sdk.init") as mock_init:
            _init_sentry(settings)
        mock_init.assert_called_once()
        assert mock_init.call_args.kwargs["dsn"] == settings.SENTRY_DSN
