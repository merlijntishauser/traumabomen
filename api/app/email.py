import logging
import smtplib
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
        logger.exception("Failed to send verification email to %s", to)
        raise
