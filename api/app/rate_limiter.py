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
import hmac
import ipaddress
import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import NamedTuple

from fastapi import HTTPException, Request

from app.config import get_settings

logger = logging.getLogger(__name__)


PROXY_SECRET_HEADER = "x-proxy-secret"  # nosec B105 - a header name, not a secret
REAL_IP_HEADER = "x-real-ip"
UNVERIFIED_WARNING_INTERVAL = 60.0  # seconds between warnings, per process
_last_unverified_warning: float | None = None


class ClientAddress(NamedTuple):
    ip: str
    verified: bool


def _is_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True


def _proxy_secret_matches(request: Request) -> bool:
    presented = request.headers.get(PROXY_SECRET_HEADER, "")
    if not presented:
        return False
    settings = get_settings()
    matched = False
    for secret in (settings.PROXY_SHARED_SECRET, settings.PROXY_SHARED_SECRET_PREVIOUS):
        if secret and hmac.compare_digest(presented.encode(), secret.encode()):
            matched = True
    return matched


def _warn_unverified() -> None:
    global _last_unverified_warning
    now = time.monotonic()
    if _last_unverified_warning is None or now - _last_unverified_warning >= (
        UNVERIFIED_WARNING_INTERVAL
    ):
        _last_unverified_warning = now
        logger.warning("Request without a valid proxy secret; client address is unverified")


def get_client_address(request: Request) -> ClientAddress:
    """Client address plus whether the proxy vouched for it.

    nginx sets X-Real-IP from the TCP peer and X-Proxy-Secret from a shared
    secret. When the secret matches, X-Real-IP is trustworthy (verified=True).
    Otherwise fall back to get_client_ip's best-effort behaviour (verified=False).
    The right-most X-Forwarded-For entry is never used.
    """
    if _proxy_secret_matches(request):
        real_ip = request.headers.get(REAL_IP_HEADER, "").strip()
        if _is_ip(real_ip):
            return ClientAddress(real_ip, True)
    if get_settings().TRUST_PROXY_HEADERS:
        _warn_unverified()
    return ClientAddress(_best_effort_ip(request), False)


def get_client_ip(request: Request) -> str:
    return get_client_address(request).ip


def _best_effort_ip(request: Request) -> str:
    """Best-effort client IP for rate limiting.

    Behind a trusted proxy (TRUST_PROXY_HEADERS), the direct TCP peer is the
    proxy / Cloud Run front-end, so read the left-most X-Forwarded-For entry
    (the original client) instead. This restores correct per-IP granularity
    for legitimate traffic. Note: a caller able to reach the origin directly
    can still spoof X-Forwarded-For, so IP limiting stays defense-in-depth --
    the per-email tarpit and high-entropy tokens are the primary controls.
    """
    if get_settings().TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",", 1)[0].strip()
            if first:
                return first
    return request.client.host if request.client else "unknown"


EXPIRY_MINUTES = 30
LOCKOUT_RETRY_AFTER = 900  # 15 minutes in seconds
CLEANUP_INTERVAL = 100  # run cleanup every N checks

# Login tarpit thresholds
FREE_ATTEMPTS = 3  # attempts 1-3: no delay
SHORT_TARPIT_THRESHOLD = 4  # attempt count that triggers short delay
SHORT_TARPIT_DELAY = 5  # seconds delay for attempts 4-6
LONG_TARPIT_THRESHOLD = 7  # attempt count that triggers long delay
LONG_TARPIT_DELAY = 30  # seconds delay for attempts 7-9
LOCKOUT_THRESHOLD = 10  # attempt count that triggers 429


@dataclass
class AttemptRecord:
    attempts: int = 0
    last_attempt: datetime = field(default_factory=lambda: datetime.now(UTC))


_by_ip: dict[str, AttemptRecord] = {}
_by_email: dict[str, AttemptRecord] = {}
_by_endpoint: dict[str, AttemptRecord] = {}
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
    for store in (_by_ip, _by_email, _by_endpoint):
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
    if attempts >= LONG_TARPIT_THRESHOLD:
        return LONG_TARPIT_DELAY
    if attempts >= SHORT_TARPIT_THRESHOLD:
        return SHORT_TARPIT_DELAY
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

    if worst >= LOCKOUT_THRESHOLD:
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


ENDPOINT_RATE_LIMIT = 20
_ADDRESSLESS_ENDPOINT = "guest-open"
ENDPOINT_WINDOW_MINUTES = 5


def check_endpoint_rate_limit(ip: str, endpoint: str) -> None:
    """Raise 429 if IP exceeds per-endpoint rate limit.

    Simple counter: ENDPOINT_RATE_LIMIT calls per ENDPOINT_WINDOW_MINUTES
    per IP per endpoint. Entries auto-expire via _cleanup().
    """
    ip = _sanitize(ip)
    key = f"{ip}:{endpoint}"
    now = datetime.now(UTC)
    window_start = now - timedelta(minutes=ENDPOINT_WINDOW_MINUTES)

    record = _by_endpoint.get(key)
    if record is None or record.last_attempt < window_start:
        _by_endpoint[key] = AttemptRecord(attempts=1, last_attempt=now)
        return

    record.attempts += 1
    record.last_attempt = now

    if record.attempts > ENDPOINT_RATE_LIMIT:
        if endpoint == _ADDRESSLESS_ENDPOINT:
            # No guest address in any app log, redacted or not.
            logger.warning("Endpoint rate limit: endpoint=%s", endpoint)
        else:
            logger.warning(
                "Endpoint rate limit: ip=%s endpoint=%s attempts=%d",
                _redact_ip(ip),
                endpoint,
                record.attempts,
            )
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Try again later.",
            headers={"Retry-After": str(ENDPOINT_WINDOW_MINUTES * 60)},
        )


# Cooldowns: an action that may happen once per window for a key, skipped
# silently (no 429) while the key cools down. Kept apart from the stores above,
# whose 30-minute expiry is shorter than a cooldown window.
_cooldowns: dict[str, datetime] = {}


def claim_cooldown(key: str, window: timedelta) -> bool:
    """Return True and start the cooldown if key is not cooling down, else False."""
    key = _sanitize(key)
    now = datetime.now(UTC)
    for expired in [k for k, until in _cooldowns.items() if until <= now]:
        del _cooldowns[expired]
    if key in _cooldowns:
        return False
    _cooldowns[key] = now + window
    return True
