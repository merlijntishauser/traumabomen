"""Tests for email sending utility."""

import threading
from unittest.mock import MagicMock, patch

import pytest

from app.config import Settings
from app.email import (
    send_email_background,
    send_feedback_email,
    send_verification_email,
    send_waitlist_approval_email,
)


@pytest.fixture
def smtp_settings():
    return Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        JWT_SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
        SMTP_HOST="smtp.example.com",
        SMTP_PORT=587,
        SMTP_FROM="noreply@example.com",
        SMTP_USER="user",
        SMTP_PASSWORD="pass",
        APP_BASE_URL="https://app.example.com",
    )


@pytest.fixture
def smtp_settings_no_auth():
    return Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        JWT_SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
        SMTP_HOST="localhost",
        SMTP_PORT=25,
        SMTP_FROM="noreply@example.com",
        SMTP_USER="",
        SMTP_PASSWORD="",
        APP_BASE_URL="https://app.example.com",
    )


class TestSendVerificationEmail:
    @patch("app.email.smtplib.SMTP")
    def test_sends_email_with_auth(self, mock_smtp_cls, smtp_settings):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_verification_email("user@example.com", "test-token-123", smtp_settings)

        mock_smtp_cls.assert_called_once_with("smtp.example.com", 587)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("user", "pass")
        mock_server.sendmail.assert_called_once()
        args = mock_server.sendmail.call_args
        assert args[0][0] == "noreply@example.com"
        assert args[0][1] == "user@example.com"
        assert "test-token-123" in args[0][2]

    @patch("app.email.smtplib.SMTP")
    def test_sends_email_without_auth(self, mock_smtp_cls, smtp_settings_no_auth):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_verification_email("user@example.com", "tok", smtp_settings_no_auth)

        mock_server.starttls.assert_not_called()
        mock_server.login.assert_not_called()
        mock_server.sendmail.assert_called_once()

    @patch("app.email.smtplib.SMTP")
    def test_raises_on_smtp_failure(self, mock_smtp_cls, smtp_settings):
        mock_smtp_cls.return_value.__enter__ = MagicMock(
            side_effect=ConnectionRefusedError("Connection refused")
        )
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        with pytest.raises(ConnectionRefusedError):
            send_verification_email("user@example.com", "tok", smtp_settings)

    @patch("app.email.smtplib.SMTP")
    def test_email_contains_verify_url(self, mock_smtp_cls, smtp_settings):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_verification_email("user@example.com", "abc123", smtp_settings)

        sent_msg = mock_server.sendmail.call_args[0][2]
        assert "https://app.example.com/verify?token=abc123" in sent_msg


class TestSendWaitlistApprovalEmail:
    @patch("app.email.smtplib.SMTP")
    def test_sends_approval_email_with_auth(self, mock_smtp_cls, smtp_settings):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_waitlist_approval_email("user@example.com", "invite-token-123", smtp_settings)

        mock_smtp_cls.assert_called_once_with("smtp.example.com", 587)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("user", "pass")
        mock_server.sendmail.assert_called_once()
        args = mock_server.sendmail.call_args
        assert args[0][0] == "noreply@example.com"
        assert args[0][1] == "user@example.com"

    @patch("app.email.smtplib.SMTP")
    def test_sends_approval_email_without_auth(self, mock_smtp_cls, smtp_settings_no_auth):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_waitlist_approval_email("user@example.com", "tok", smtp_settings_no_auth)

        mock_server.starttls.assert_not_called()
        mock_server.login.assert_not_called()
        mock_server.sendmail.assert_called_once()

    @patch("app.email.smtplib.SMTP")
    def test_email_contains_register_url(self, mock_smtp_cls, smtp_settings):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_waitlist_approval_email("user@example.com", "invite-abc", smtp_settings)

        sent_msg = mock_server.sendmail.call_args[0][2]
        assert "https://app.example.com/register?invite=invite-abc" in sent_msg

    @patch("app.email.smtplib.SMTP")
    def test_raises_on_smtp_failure(self, mock_smtp_cls, smtp_settings):
        mock_smtp_cls.return_value.__enter__ = MagicMock(
            side_effect=ConnectionRefusedError("Connection refused")
        )
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        with pytest.raises(ConnectionRefusedError):
            send_waitlist_approval_email("user@example.com", "tok", smtp_settings)


class TestSendFeedbackEmail:
    @patch("app.email.smtplib.SMTP")
    def test_sends_feedback_email(self, mock_smtp_cls, smtp_settings):
        smtp_settings.FEEDBACK_EMAIL = "feedback@example.com"
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_feedback_email("bug", "Something broke", "user@test.com", smtp_settings)

        mock_server.sendmail.assert_called_once()
        args = mock_server.sendmail.call_args
        assert args[0][1] == "feedback@example.com"
        assert "bug" in args[0][2].lower()

    @patch("app.email.smtplib.SMTP")
    def test_sends_feedback_email_anonymous(self, mock_smtp_cls, smtp_settings):
        smtp_settings.FEEDBACK_EMAIL = "feedback@example.com"
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_feedback_email("feature", "Add this", None, smtp_settings)

        mock_server.sendmail.assert_called_once()
        sent_msg = mock_server.sendmail.call_args[0][2]
        assert "Anonymous" in sent_msg

    @patch("app.email.smtplib.SMTP")
    def test_skips_when_no_feedback_email(self, mock_smtp_cls, smtp_settings):
        smtp_settings.FEEDBACK_EMAIL = ""
        send_feedback_email("bug", "test", "user@test.com", smtp_settings)
        mock_smtp_cls.assert_not_called()

    @patch("app.email.smtplib.SMTP")
    def test_does_not_raise_on_smtp_failure(self, mock_smtp_cls, smtp_settings):
        smtp_settings.FEEDBACK_EMAIL = "feedback@example.com"
        mock_smtp_cls.return_value.__enter__ = MagicMock(
            side_effect=ConnectionRefusedError("Connection refused")
        )
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        # Should not raise -- feedback email failures are logged, not propagated
        send_feedback_email("bug", "test", "user@test.com", smtp_settings)


class TestSendEmailBackground:
    def test_calls_function_with_args(self):
        fn = MagicMock()
        done = threading.Event()
        fn.side_effect = lambda *a: done.set()

        send_email_background(fn, "arg1", "arg2")
        done.wait(timeout=2)

        fn.assert_called_once_with("arg1", "arg2")

    @patch("app.email.RETRY_DELAY_SECONDS", 0)
    def test_retries_once_on_failure_then_succeeds(self):
        done = threading.Event()
        call_count = 0

        def side_effect(*_args):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ConnectionError("SMTP down")
            done.set()

        fn = MagicMock(side_effect=side_effect)

        send_email_background(fn, "a")
        done.wait(timeout=2)

        assert fn.call_count == 2

    @patch("app.email.RETRY_DELAY_SECONDS", 0)
    def test_gives_up_after_two_failures(self):
        done = threading.Event()
        call_count = 0

        def side_effect(*_args):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                done.set()
            raise ConnectionError("SMTP down")

        fn = MagicMock(side_effect=side_effect)

        send_email_background(fn, "a")
        done.wait(timeout=2)

        assert fn.call_count == 2

    def test_thread_is_daemon(self):
        fn = MagicMock()
        started_threads: list[threading.Thread] = []
        original_init = threading.Thread.__init__

        def capture_init(self, *args, **kwargs):
            original_init(self, *args, **kwargs)
            started_threads.append(self)

        with patch.object(threading.Thread, "__init__", capture_init):
            send_email_background(fn)

        assert len(started_threads) == 1
        assert started_threads[0].daemon is True
