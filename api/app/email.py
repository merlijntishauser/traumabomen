import contextlib
import logging
import smtplib
import time
from collections.abc import Callable
from datetime import UTC, datetime
from email.message import Message
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
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


# ---------------------------------------------------------------------------
# Shared HTML email layout
# ---------------------------------------------------------------------------

# Inline SVG leaf icon used as a subtle decorative separator.
# Kept small and simple for broad email client compatibility.
_LEAF_SVG = (
    '<img src="data:image/svg+xml,'
    "%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' "
    "fill='none' stroke='%232d8a5e' stroke-width='1.5' stroke-linecap='round' "
    "stroke-linejoin='round'%3E%3Cpath d='M12 22c-4-4-8-7.5-8-12C4 5 8 2 12 2s8 3 8 "
    "8c0 4.5-4 8-8 12z'/%3E%3Cpath d='M12 22V8'/%3E%3C/svg%3E"
    '" alt="" width="24" height="24" '
    'style="display:block;margin:0 auto 0 auto;opacity:0.4;" />'
)


def _email_layout(heading: str, body_html: str, footer_html: str) -> str:
    """Wrap email content in a styled HTML layout.

    Uses table-based layout with inline styles for broad email client
    compatibility (Gmail, Outlook, Apple Mail, etc.).
    """
    return f"""\
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>{heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef0eb;font-family:Georgia,'Times New Roman',serif;">
  <!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef0eb;">
    <tr>
      <td align="center" style="padding:32px 16px 24px 16px;">

        <!-- Card -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06),0 0 0 1px rgba(45,138,94,0.08);">

          <!-- Accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#2d8a5e 0%,#3da87a 50%,rgba(45,138,94,0.2) 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 12px 40px;text-align:center;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;color:#1a2e1f;letter-spacing:0.5px;">{heading}</h1>
            </td>
          </tr>

          <!-- Leaf divider -->
          <tr>
            <td style="padding:8px 0 8px 0;text-align:center;">
              {_LEAF_SVG}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 28px 40px;font-family:'Lato','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a2e1f;">
              {body_html}
            </td>
          </tr>

          <!-- Footer divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #dde2d9;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px 40px;font-family:'Lato','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#8a9a8e;text-align:center;">
              {footer_html}
            </td>
          </tr>

        </table>
        <!-- /Card -->

        <!-- Outer footer -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="padding:16px 40px 0 40px;font-family:'Lato','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a9a8e;text-align:center;">
              Personal reflection tool, not therapy
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>"""


def _button_html(url: str, label: str) -> str:
    """Render a styled CTA button that works across email clients."""
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:24px 0 8px 0;">'
        "<tr><td>"
        "<!--[if mso]>"
        '<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" '
        'xmlns:w="urn:schemas-microsoft-com:office:word" '
        f'href="{url}" '
        'style="height:44px;v-text-anchor:middle;width:220px;" '
        'arcsize="14%" strokecolor="#24704c" fillcolor="#2d8a5e">'
        "<w:anchorlock/>"
        '<center style="color:#ffffff;font-family:Lato,Helvetica,Arial,sans-serif;'
        f'font-size:15px;font-weight:bold;">{label}</center>'
        "</v:roundrect>"
        "<![endif]-->"
        "<!--[if !mso]><!-->"
        f'<a href="{url}" target="_blank" '
        'style="display:inline-block;padding:12px 32px;'
        "background-color:#2d8a5e;color:#ffffff;font-family:'Lato','Helvetica Neue',"
        "Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;"
        "text-decoration:none;border-radius:6px;"
        'border:1px solid #24704c;">'
        f"{label}"
        "</a>"
        "<!--<![endif]-->"
        "</td></tr></table>"
    )


def _link_text(url: str, label: str) -> str:
    """Render a copy-paste link with label."""
    return (
        f'<p style="margin:16px 0 0 0;font-size:13px;color:#5a6e5f;">'
        f"{label}"
        "</p>"
        f'<p style="margin:4px 0 0 0;font-size:13px;word-break:break-all;">'
        f'<a href="{url}" style="color:#2d8a5e;text-decoration:underline;">'
        f"{url}</a></p>"
    )


# ---------------------------------------------------------------------------
# Verification email
# ---------------------------------------------------------------------------

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


def _send_cta_email(
    to: str,
    url: str,
    strings: dict[str, dict[str, str]],
    settings: Settings,
    language: str,
    log_label: str,
) -> None:
    """Assemble and send a transactional email with a CTA button and link."""
    s = strings.get(language, strings["en"])

    body_html = (
        f'<p style="margin:0 0 4px 0;">{s["body"]}</p>'
        f"{_button_html(url, s['button'])}"
        f"{_link_text(url, s['copy'])}"
    )
    footer_html = f'<p style="margin:0;">{s["expiry"]}</p>'
    html = _email_layout(s["heading"], body_html, footer_html)
    text = f"{s['text_heading']} - {s['subject']}\n\n{s['text_body']}\n\n{url}\n\n{s['expiry']}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{s['subject']} - {s['heading']}"
    msg["From"] = formataddr((s["heading"], settings.SMTP_FROM))
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        _send_smtp(msg, to, settings)
    except (smtplib.SMTPException, OSError):
        safe_to = to.replace("\n", "").replace("\r", "")
        logger.exception("Failed to send %s to %s", log_label, safe_to)
        raise


def send_verification_email(to: str, token: str, settings: Settings, language: str = "en") -> None:
    base_url = _get_base_url(settings, language)
    _send_cta_email(
        to,
        f"{base_url}/verify?token={token}",
        _VERIFICATION_STRINGS,
        settings,
        language,
        "verification email",
    )


# ---------------------------------------------------------------------------
# Waitlist approval email
# ---------------------------------------------------------------------------

_WAITLIST_STRINGS = {
    "en": {
        "heading": "Traumatrees",
        "subject": "You're in! Complete your registration",
        "body": "A spot has opened up! Complete your registration to get started.",
        "button": "Complete registration",
        "copy": "Or copy this link:",
        "expiry": "This link expires in 7 days. If you did not join the waitlist, you can ignore this email.",
        "text_heading": "Traumatrees",
        "text_body": "A spot has opened up. Click the link below to complete your registration:",
    },
    "nl": {
        "heading": "Traumabomen",
        "subject": "Je bent aan de beurt! Voltooi je registratie",
        "body": "Er is een plek vrijgekomen! Voltooi je registratie om te beginnen.",
        "button": "Registratie voltooien",
        "copy": "Of kopieer deze link:",
        "expiry": "Deze link verloopt na 7 dagen. Als je je niet hebt aangemeld voor de wachtlijst, kun je deze e-mail negeren.",
        "text_heading": "Traumabomen",
        "text_body": "Er is een plek vrijgekomen. Klik op de onderstaande link om je registratie te voltooien:",
    },
}


def send_waitlist_approval_email(
    to: str, token: str, settings: Settings, language: str = "en"
) -> None:
    base_url = _get_base_url(settings, language)
    _send_cta_email(
        to,
        f"{base_url}/register?invite={token}",
        _WAITLIST_STRINGS,
        settings,
        language,
        "waitlist approval email",
    )


# ---------------------------------------------------------------------------
# Feedback email (internal, plain text only)
# ---------------------------------------------------------------------------


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
    except (smtplib.SMTPException, OSError):
        logger.exception("Failed to send feedback email")


# ---------------------------------------------------------------------------
# Background sender with one retry
# ---------------------------------------------------------------------------

RETRY_DELAY_SECONDS = 5


def send_email_background(fn: Callable[..., None], *args: Any) -> None:
    """Run an email-sending function in a daemon thread with one retry."""

    def _worker() -> None:
        try:
            fn(*args)
        except (smtplib.SMTPException, OSError):
            time.sleep(RETRY_DELAY_SECONDS)
            with contextlib.suppress(
                smtplib.SMTPException, OSError
            ):  # Already logged by each send_* fn
                fn(*args)

    Thread(target=_worker, daemon=True).start()
