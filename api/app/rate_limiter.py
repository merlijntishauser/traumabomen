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


def _sanitize(value: str) -> str:
    """Strip newlines to prevent log injection."""
    return value.replace("\r", "").replace("\n", "")


def _redact_ip(ip: str) -> str:
    """Redact the last octet of an IP address for logging (e.g. '1.2.3.x')."""
    parts = ip.rsplit(".", 1)
    if len(parts) == 2:
        return _sanitize(f"{parts[0]}.x")
    return "x"


def _redact_email(email: str) -> str:
    """Redact email to domain only for logging (e.g. '*@example.com')."""
    parts = email.split("@", 1)
    if len(parts) == 2:
        return _sanitize(f"*@{parts[1]}")
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
    for store in (_by_ip, _by_email):
        expired = [k for k, v in store.items() if v.last_attempt < cutoff]
        for k in expired:
            del store[k]


def _worst_attempts(ip: str, email: str) -> int:
    """Return the higher of the IP and email attempt counts."""
    ip_count = _by_ip[ip].attempts if ip in _by_ip else 0
    email_count = _by_email[email].attempts if email in _by_email else 0
    return max(ip_count, email_count)


def _tarpit_delay(attempts: int) -> int:
    """Return tarpit delay in seconds for the given attempt count (0 = no delay)."""
    if attempts >= 7:
        return 30
    if attempts >= 4:
        return 5
    return 0


async def check_and_tarpit(ip: str, email: str) -> None:
    """Check attempt counts and apply tarpit delay or lockout.

    Raises:
        HTTPException: 429 if the attempt count reaches lockout threshold.
    """
    ip = _sanitize(ip)
    email = _sanitize(email)
    global _check_counter
    _check_counter += 1
    if _check_counter >= CLEANUP_INTERVAL:
        _cleanup()
        _check_counter = 0

    worst = _worst_attempts(ip, email)

    if worst >= 10:
        logger.warning(
            "Login lockout: ip=%s email=%s attempts=%d", _redact_ip(ip), _redact_email(email), worst
        )
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(LOCKOUT_RETRY_AFTER)},
        )

    delay = _tarpit_delay(worst)
    if delay:
        logger.warning(
            "Login tarpit (%ds): ip=%s email=%s attempts=%d",
            delay,
            _redact_ip(ip),
            _redact_email(email),
            worst,
        )
        await asyncio.sleep(delay)
