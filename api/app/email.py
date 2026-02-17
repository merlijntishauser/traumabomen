import logging
import smtplib
from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import Settings

logger = logging.getLogger(__name__)


def send_verification_email(to: str, token: str, settings: Settings) -> None:
    verify_url = f"{settings.APP_BASE_URL}/verify?token={token}"

    html = f"""\
<html>
<body style="font-family: 'Source Sans 3', sans-serif; color: #1a2e1f; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="font-family: Georgia, serif; color: #1a2e1f;">Traumabomen</h2>
  <p>Verify your email address to get started.</p>
  <p>
    <a href="{verify_url}"
       style="display: inline-block; padding: 10px 24px; background: #2d8a5e; color: #fff; text-decoration: none; border-radius: 6px;">
      Verify email
    </a>
  </p>
  <p style="color: #5a6e5f; font-size: 14px;">
    Or copy this link: {verify_url}
  </p>
  <p style="color: #5a6e5f; font-size: 14px;">
    This link expires in 24 hours. If you did not create an account, you can ignore this email.
  </p>
</body>
</html>"""

    text = (
        f"Traumabomen - Verify your email\n\n"
        f"Click the link below to verify your email address:\n\n"
        f"{verify_url}\n\n"
        f"This link expires in 24 hours. "
        f"If you did not create an account, you can ignore this email."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your email - Traumabomen"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USER:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())
    except Exception:
        safe_to = to.replace("\n", "").replace("\r", "")
        logger.exception("Failed to send verification email to %s", safe_to)
        raise


def send_waitlist_approval_email(to: str, token: str, settings: Settings) -> None:
    register_url = f"{settings.APP_BASE_URL}/register?invite={token}"

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
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USER:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())
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
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USER:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, settings.FEEDBACK_EMAIL, msg.as_string())
    except Exception:
        logger.exception("Failed to send feedback email")
