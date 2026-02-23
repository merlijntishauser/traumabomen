"""In-memory login rate limiter with progressive tarpit and lockout.

Tracks failed login attempts by IP address and email separately.
On each login attempt, the worse (higher) counter of the two drives
the delay or lockout decision:

| Attempts | Action                                  |
|----------|-----------------------------------------|
| 1-3      | None                                    |
| 4-6      | asyncio.sleep(5)                        |
| 7-9      | asyncio.sleep(30)                       |
| 10+      | Immediate 429 with Retry-After: 900     |

Entries auto-expire after 30 minutes of no new attempts.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

logger = logging.getLogger(__name__)

EXPIRY_MINUTES = 30
LOCKOUT_RETRY_AFTER = 900  # 15 minutes in seconds
CLEANUP_INTERVAL = 100  # run cleanup every N checks


@dataclass
class AttemptRecord:
    attempts: int = 0
    last_attempt: datetime = field(default_factory=lambda: datetime.now(UTC))


_by_ip: dict[str, AttemptRecord] = {}
_by_email: dict[str, AttemptRecord] = {}
_check_counter: int = 0


def _redact_ip(ip: str) -> str:
    """Redact the last octet of an IP address for logging (e.g. '1.2.3.x')."""
    parts = ip.rsplit(".", 1)
    if len(parts) == 2:
        return f"{parts[0]}.x"
    return "x"


def _redact_email(email: str) -> str:
    """Redact email to domain only for logging (e.g. '*@example.com')."""
    parts = email.split("@", 1)
    if len(parts) == 2:
        return f"*@{parts[1]}"
    return "*@unknown"


def record_failure(ip: str, email: str) -> None:
    """Record a failed login attempt for both IP and email."""
    now = datetime.now(UTC)

    if ip in _by_ip:
        _by_ip[ip].attempts += 1
        _by_ip[ip].last_attempt = now
    else:
        _by_ip[ip] = AttemptRecord(attempts=1, last_attempt=now)

    if email in _by_email:
        _by_email[email].attempts += 1
        _by_email[email].last_attempt = now
    else:
        _by_email[email] = AttemptRecord(attempts=1, last_attempt=now)


def clear(ip: str, email: str) -> None:
    """Clear attempt records for the given IP and email (called on successful login)."""
    _by_ip.pop(ip, None)
    _by_email.pop(email, None)


def _cleanup() -> None:
    """Evict entries older than EXPIRY_MINUTES."""
    cutoff = datetime.now(UTC) - timedelta(minutes=EXPIRY_MINUTES)

    expired_ips = [ip for ip, rec in _by_ip.items() if rec.last_attempt < cutoff]
    for ip in expired_ips:
        del _by_ip[ip]

    expired_emails = [email for email, rec in _by_email.items() if rec.last_attempt < cutoff]
    for email in expired_emails:
        del _by_email[email]


async def check_and_tarpit(ip: str, email: str) -> None:
    """Check attempt counts and apply tarpit delay or lockout.

    Looks up the worse of the IP and email counters.
    Runs periodic cleanup every CLEANUP_INTERVAL calls.

    Raises:
        HTTPException: 429 if the attempt count reaches lockout threshold.
    """
    global _check_counter
    _check_counter += 1

    if _check_counter >= CLEANUP_INTERVAL:
        _cleanup()
        _check_counter = 0

    ip_rec = _by_ip.get(ip)
    email_rec = _by_email.get(email)

    ip_attempts = ip_rec.attempts if ip_rec else 0
    email_attempts = email_rec.attempts if email_rec else 0
    worst = max(ip_attempts, email_attempts)

    if worst >= 10:
        logger.warning(
            "Login lockout: ip=%s email=%s attempts=%d",
            _redact_ip(ip),
            _redact_email(email),
            worst,
        )
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(LOCKOUT_RETRY_AFTER)},
        )

    if worst >= 7:
        logger.warning(
            "Login tarpit (30s): ip=%s email=%s attempts=%d",
            _redact_ip(ip),
            _redact_email(email),
            worst,
        )
        await asyncio.sleep(30)
    elif worst >= 4:
        logger.warning(
            "Login tarpit (5s): ip=%s email=%s attempts=%d",
            _redact_ip(ip),
            _redact_email(email),
            worst,
        )
        await asyncio.sleep(5)
