import contextlib
import logging
import smtplib
import time
from collections.abc import Callable
from datetime import UTC, datetime
from email.message import Message
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from threading import Thread
from typing import Any

from app.config import Settings

logger = logging.getLogger(__name__)


def _send_smtp(msg: Message, to: str, settings: Settings) -> None:
    """Send an email message via SMTP, handling connection, TLS, and auth."""
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to, msg.as_string())


def _get_base_url(settings: Settings, language: str) -> str:
    """Return the base URL matching the user's language."""
    if language == "nl" and settings.APP_BASE_URL_NL:
        return settings.APP_BASE_URL_NL.rstrip("/")
    return settings.APP_BASE_URL.rstrip("/")


_VERIFICATION_STRINGS = {
    "en": {
        "heading": "Traumatrees",
        "body": "Verify your email address to get started.",
        "button": "Verify email",
        "copy": "Or copy this link:",
        "expiry": "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
        "subject": "Verify your email",
        "text_heading": "Traumatrees",
        "text_body": "Click the link below to verify your email address:",
    },
    "nl": {
        "heading": "Traumabomen",
        "body": "Verifieer je e-mailadres om te beginnen.",
        "button": "E-mail verifi\u00ebren",
        "copy": "Of kopieer deze link:",
        "expiry": "Deze link verloopt na 24 uur. Als je geen account hebt aangemaakt, kun je deze e-mail negeren.",
        "subject": "Verifieer je e-mailadres",
        "text_heading": "Traumabomen",
        "text_body": "Klik op de onderstaande link om je e-mailadres te verifi\u00ebren:",
    },
}


def send_verification_email(to: str, token: str, settings: Settings, language: str = "en") -> None:
    base_url = _get_base_url(settings, language)
    verify_url = f"{base_url}/verify?token={token}"
    s = _VERIFICATION_STRINGS.get(language, _VERIFICATION_STRINGS["en"])

    html = f"""\
<html>
<body style="font-family: 'Source Sans 3', sans-serif; color: #1a2e1f; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="font-family: Georgia, serif; color: #1a2e1f;">{s["heading"]}</h2>
  <p>{s["body"]}</p>
  <p>
    <a href="{verify_url}"
       style="display: inline-block; padding: 10px 24px; background: #2d8a5e; color: #fff; text-decoration: none; border-radius: 6px;">
      {s["button"]}
    </a>
  </p>
  <p style="color: #5a6e5f; font-size: 14px;">
    {s["copy"]} {verify_url}
  </p>
  <p style="color: #5a6e5f; font-size: 14px;">
    {s["expiry"]}
  </p>
</body>
</html>"""

    text = (
        f"{s['text_heading']} - {s['subject']}\n\n{s['text_body']}\n\n{verify_url}\n\n{s['expiry']}"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{s['subject']} - {s['heading']}"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        _send_smtp(msg, to, settings)
    except Exception:
        safe_to = to.replace("\n", "").replace("\r", "")
        logger.exception("Failed to send verification email to %s", safe_to)
        raise


def send_waitlist_approval_email(
    to: str, token: str, settings: Settings, language: str = "en"
) -> None:
    base_url = _get_base_url(settings, language)
    register_url = f"{base_url}/register?invite={token}"

    html = f"""\
<html>
<body style="font-family: 'Source Sans 3', sans-serif; color: #1a2e1f; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="font-family: Georgia, serif; color: #1a2e1f;">Traumabomen</h2>
  <p>A spot has opened up! Complete your registration to get started.</p>
  <p>
    <a href="{register_url}"
       style="display: inline-block; padding: 10px 24px; background: #2d8a5e; color: #fff; text-decoration: none; border-radius: 6px;">
      Complete registration
    </a>
  </p>
  <p style="color: #5a6e5f; font-size: 14px;">
    Or copy this link: {register_url}
  </p>
  <p style="color: #5a6e5f; font-size: 14px;">
    This link expires in 7 days. If you did not join the waitlist, you can ignore this email.
  </p>
</body>
</html>"""

    text = (
        f"Traumabomen - You're in!\n\n"
        f"A spot has opened up. Click the link below to complete your registration:\n\n"
        f"{register_url}\n\n"
        f"This link expires in 7 days. "
        f"If you did not join the waitlist, you can ignore this email."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "You're in! Complete your Traumabomen registration"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        _send_smtp(msg, to, settings)
    except Exception:
        safe_to = to.replace("\n", "").replace("\r", "")
        logger.exception("Failed to send waitlist approval email to %s", safe_to)
        raise


def send_feedback_email(
    category: str, message: str, user_email: str | None, settings: Settings
) -> None:
    if not settings.FEEDBACK_EMAIL:
        logger.warning("FEEDBACK_EMAIL not configured, skipping feedback notification")
        return

    sender = user_email or "Anonymous"
    subject = f"[Feedback] {category.capitalize()} from {sender}"
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")

    text = f"Category: {category}\nFrom: {sender}\nTime: {timestamp}\n\n{message}"

    msg = MIMEText(text, "plain")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = settings.FEEDBACK_EMAIL

    try:
        _send_smtp(msg, settings.FEEDBACK_EMAIL, settings)
    except Exception:
        logger.exception("Failed to send feedback email")


RETRY_DELAY_SECONDS = 5


def send_email_background(fn: Callable[..., None], *args: Any) -> None:
    """Run an email-sending function in a daemon thread with one retry."""

    def _worker() -> None:
        try:
            fn(*args)
        except Exception:
            time.sleep(RETRY_DELAY_SECONDS)
            with contextlib.suppress(Exception):  # Already logged by each send_* fn
                fn(*args)

    Thread(target=_worker, daemon=True).start()
