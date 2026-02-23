# API Rate Limiting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two-layer rate limiting: nginx for coarse IP-based throttling, application layer for intelligent login backoff with tarpitting.

**Architecture:** Nginx `limit_req_zone` directives (3 zones: auth_strict 5/min, auth_general 20/min, api_global 120/min) stop volumetric attacks before they reach Python. Application-layer login backoff tracks failed attempts by IP and email in-memory, applies progressive delays (5s/30s), and locks out after 10 failures for 15 minutes.

**Tech Stack:** Nginx limit_req module, Python asyncio (no new dependencies), FastAPI Request object for client IP.

**Design doc:** `docs/plans/2026-02-22-api-rate-limiting-design.md`

---

### Task 1: Create rate limiter module with unit tests

**Files:**
- Create: `api/app/rate_limiter.py`
- Create: `api/tests/test_rate_limiter.py`

**Step 1: Write the failing tests**

Create `api/tests/test_rate_limiter.py`:

```python
"""Tests for login rate limiter (in-memory backoff and lockout)."""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.rate_limiter import (
    _by_email,
    _by_ip,
    check_and_tarpit,
    clear,
    record_failure,
)


@pytest.fixture(autouse=True)
def _clean_state():
    """Reset rate limiter state between tests."""
    _by_ip.clear()
    _by_email.clear()
    yield
    _by_ip.clear()
    _by_email.clear()


class TestRecordFailure:
    def test_records_ip(self):
        record_failure("1.2.3.4", "user@example.com")
        assert _by_ip["1.2.3.4"].attempts == 1

    def test_records_email(self):
        record_failure("1.2.3.4", "user@example.com")
        assert _by_email["user@example.com"].attempts == 1

    def test_increments_on_repeated_failures(self):
        record_failure("1.2.3.4", "user@example.com")
        record_failure("1.2.3.4", "user@example.com")
        assert _by_ip["1.2.3.4"].attempts == 2
        assert _by_email["user@example.com"].attempts == 2

    def test_tracks_ip_and_email_separately(self):
        record_failure("1.1.1.1", "user@example.com")
        record_failure("2.2.2.2", "user@example.com")
        assert _by_ip["1.1.1.1"].attempts == 1
        assert _by_ip["2.2.2.2"].attempts == 1
        assert _by_email["user@example.com"].attempts == 2


class TestClear:
    def test_clears_both_counters(self):
        record_failure("1.2.3.4", "user@example.com")
        clear("1.2.3.4", "user@example.com")
        assert "1.2.3.4" not in _by_ip
        assert "user@example.com" not in _by_email

    def test_clear_nonexistent_is_safe(self):
        clear("9.9.9.9", "nobody@example.com")  # no error


class TestCheckAndTarpit:
    async def test_no_delay_under_threshold(self):
        for _ in range(3):
            record_failure("1.2.3.4", "user@example.com")
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await check_and_tarpit("1.2.3.4", "user@example.com")
            mock_sleep.assert_not_called()

    async def test_tarpit_at_4_failures(self):
        for _ in range(4):
            record_failure("1.2.3.4", "user@example.com")
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await check_and_tarpit("1.2.3.4", "user@example.com")
            mock_sleep.assert_called_once_with(5)

    async def test_tarpit_at_7_failures(self):
        for _ in range(7):
            record_failure("1.2.3.4", "user@example.com")
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await check_and_tarpit("1.2.3.4", "user@example.com")
            mock_sleep.assert_called_once_with(30)

    async def test_lockout_at_10_failures(self):
        for _ in range(10):
            record_failure("1.2.3.4", "user@example.com")
        with pytest.raises(HTTPException) as exc_info:
            await check_and_tarpit("1.2.3.4", "user@example.com")
        assert exc_info.value.status_code == 429
        assert exc_info.value.headers["Retry-After"] == "900"

    async def test_uses_worse_of_ip_and_email(self):
        """Email has 7 failures from different IPs; new IP should still tarpit."""
        for i in range(7):
            record_failure(f"10.0.0.{i}", "user@example.com")
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await check_and_tarpit("10.0.0.99", "user@example.com")
            mock_sleep.assert_called_once_with(30)

    async def test_no_records_means_no_delay(self):
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            await check_and_tarpit("1.2.3.4", "user@example.com")
            mock_sleep.assert_not_called()


class TestCleanup:
    async def test_old_entries_cleaned_up(self):
        record_failure("1.2.3.4", "user@example.com")
        # Artificially age the entry to 31 minutes ago
        _by_ip["1.2.3.4"].last_attempt = datetime.now(UTC) - timedelta(minutes=31)
        _by_email["user@example.com"].last_attempt = datetime.now(UTC) - timedelta(minutes=31)

        # Trigger cleanup by calling check_and_tarpit (runs every 100 calls)
        # Force it by setting the counter
        import app.rate_limiter as rl
        rl._check_counter = 99
        await check_and_tarpit("5.5.5.5", "other@example.com")

        assert "1.2.3.4" not in _by_ip
        assert "user@example.com" not in _by_email

    async def test_lockout_expires_after_30_min(self):
        for _ in range(10):
            record_failure("1.2.3.4", "user@example.com")
        # Artificially age to 31 minutes
        _by_ip["1.2.3.4"].last_attempt = datetime.now(UTC) - timedelta(minutes=31)
        _by_email["user@example.com"].last_attempt = datetime.now(UTC) - timedelta(minutes=31)

        import app.rate_limiter as rl
        rl._check_counter = 99
        # Should not raise because entries are stale and get cleaned
        await check_and_tarpit("1.2.3.4", "user@example.com")
```

**Step 2: Run tests to verify they fail**

Run: `docker compose exec api uv run pytest tests/test_rate_limiter.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.rate_limiter'`

**Step 3: Write the rate limiter module**

Create `api/app/rate_limiter.py`:

```python
"""In-memory login rate limiter with progressive backoff and lockout.

Tracks failed login attempts by IP address and email address separately.
Applies progressive delays (tarpitting) and temporary lockout after
repeated failures.

Tarpit schedule (based on whichever counter is higher):
  1-3 attempts: no delay
  4-6 attempts: 5 second delay
  7-9 attempts: 30 second delay
  10+ attempts: immediate 429 with 15 minute lockout

Entries auto-expire after 30 minutes of no new attempts.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException

logger = logging.getLogger(__name__)

EXPIRY_MINUTES = 30
LOCKOUT_SECONDS = 900  # 15 minutes


@dataclass
class AttemptRecord:
    attempts: int = 0
    last_attempt: datetime = field(default_factory=lambda: datetime.now(UTC))


_by_ip: dict[str, AttemptRecord] = {}
_by_email: dict[str, AttemptRecord] = {}
_check_counter: int = 0


def _redact_ip(ip: str) -> str:
    """Redact last octet for privacy-safe logging."""
    parts = ip.rsplit(".", 1)
    return f"{parts[0]}.x" if len(parts) == 2 else ip


def _redact_email(email: str) -> str:
    """Show only domain for privacy-safe logging."""
    parts = email.split("@", 1)
    return f"*@{parts[1]}" if len(parts) == 2 else "***"


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
    """Clear counters for IP and email on successful login."""
    _by_ip.pop(ip, None)
    _by_email.pop(email, None)


def _cleanup() -> None:
    """Evict entries older than EXPIRY_MINUTES."""
    cutoff = datetime.now(UTC) - timedelta(minutes=EXPIRY_MINUTES)
    for store in (_by_ip, _by_email):
        expired = [k for k, v in store.items() if v.last_attempt < cutoff]
        for k in expired:
            del store[k]


async def check_and_tarpit(ip: str, email: str) -> None:
    """Check attempt counters and apply delay or lockout.

    Must be called before authentication so locked-out IPs/emails
    must wait even with correct credentials.
    """
    global _check_counter
    _check_counter += 1
    if _check_counter >= 100:
        _cleanup()
        _check_counter = 0

    ip_rec = _by_ip.get(ip)
    email_rec = _by_email.get(email)
    attempts = max(
        ip_rec.attempts if ip_rec else 0,
        email_rec.attempts if email_rec else 0,
    )

    if attempts >= 10:
        logger.warning(
            "Login lockout: ip=%s email=%s attempts=%d",
            _redact_ip(ip),
            _redact_email(email),
            attempts,
        )
        raise HTTPException(
            status_code=429,
            detail="too_many_attempts",
            headers={"Retry-After": str(LOCKOUT_SECONDS)},
        )

    if attempts >= 7:
        delay = 30
    elif attempts >= 4:
        delay = 5
    else:
        return

    logger.warning(
        "Login tarpit: ip=%s email=%s attempts=%d delay=%ds",
        _redact_ip(ip),
        _redact_email(email),
        attempts,
        delay,
    )
    await asyncio.sleep(delay)
```

**Step 4: Run tests to verify they pass**

Run: `docker compose exec api uv run pytest tests/test_rate_limiter.py -v`
Expected: All 13 tests PASS

**Step 5: Run type checker and security scan**

Run: `docker compose exec api uv run mypy app/rate_limiter.py`
Run: `docker compose exec api uv run bandit -r app/rate_limiter.py`

**Step 6: Commit**

```bash
git add api/app/rate_limiter.py api/tests/test_rate_limiter.py
git commit -m "Add in-memory login rate limiter with progressive backoff"
```

---

### Task 2: Integrate rate limiter into login endpoint

**Files:**
- Modify: `api/app/routers/auth.py:146-166` (login endpoint)
- Create: `api/tests/test_rate_limiter_integration.py`

**Step 1: Write the failing integration tests**

Create `api/tests/test_rate_limiter_integration.py`:

```python
"""Integration tests for login rate limiting."""

import pytest

from app.rate_limiter import _by_email, _by_ip
from tests.conftest import create_user


@pytest.fixture(autouse=True)
def _clean_rate_limiter():
    """Reset rate limiter state between tests."""
    _by_ip.clear()
    _by_email.clear()
    yield
    _by_ip.clear()
    _by_email.clear()


class TestLoginRateLimiting:
    @pytest.mark.asyncio
    async def test_lockout_after_10_failures(self, client, user):
        """10 failed logins cause the 11th to return 429."""
        for _ in range(10):
            resp = await client.post(
                "/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )
            assert resp.status_code in (401, 429)

        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_successful_login_resets_counter(self, client, user):
        """Fail 5 times, succeed, fail again: counter resets."""
        for _ in range(5):
            await client.post(
                "/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        # Successful login resets counters
        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
        assert resp.status_code == 200

        assert "test@example.com" not in _by_email

    @pytest.mark.asyncio
    async def test_429_includes_retry_after(self, client, user):
        """429 response includes Retry-After header."""
        for _ in range(10):
            await client.post(
                "/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        resp = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
        assert resp.status_code == 429
        assert resp.headers.get("retry-after") == "900"
```

**Step 2: Run tests to verify they fail**

Run: `docker compose exec api uv run pytest tests/test_rate_limiter_integration.py -v`
Expected: FAIL (rate limiter not yet wired into login endpoint)

**Step 3: Integrate rate limiter into login endpoint**

Modify `api/app/routers/auth.py`. Add `Request` import and rate limiter imports, then update the login function:

Add to imports (near top):
```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
```

Add rate limiter import:
```python
from app.rate_limiter import check_and_tarpit, clear, record_failure
```

Replace the login endpoint (lines 146-166) with:
```python
@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    ip = request.client.host if request.client else "unknown"
    email = body.email.strip().lower()

    await check_and_tarpit(ip, email)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        record_failure(ip, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="email_not_verified")

    clear(ip, email)

    db.add(LoginEvent(user_id=user.id))
    await db.commit()

    return _build_token_response(user, settings)
```

**Step 4: Run integration tests to verify they pass**

Run: `docker compose exec api uv run pytest tests/test_rate_limiter_integration.py -v`
Expected: All 3 tests PASS

**Step 5: Run full test suite**

Run: `docker compose exec api uv run pytest -v`
Expected: All tests PASS (existing auth tests should still work; httpx AsyncClient sets `client.host` to a test value)

**Step 6: Run type checker and security scan**

Run: `docker compose exec api uv run mypy app/routers/auth.py`
Run: `docker compose exec api uv run bandit -r app/`

**Step 7: Commit**

```bash
git add api/app/routers/auth.py api/tests/test_rate_limiter_integration.py
git commit -m "Integrate login rate limiter with progressive backoff"
```

---

### Task 3: Add nginx rate limiting

**Files:**
- Modify: `frontend/nginx.conf`

**Step 1: Add rate limit zones and split API location blocks**

Replace the full `frontend/nginx.conf` content. The `limit_req_zone` directives go alongside the existing `map` directives (both are http-context level). The single `/api/` location block splits into three (most specific first):

```nginx
map $host $og_lang {
    "~*traumabomen"  "nl";
    default          "en";
}

map $host $og_locale {
    "~*traumabomen"  "nl_NL";
    default          "en_US";
}

map $host $og_title {
    "~*traumabomen"  "Traumabomen";
    default          "Traumatrees";
}

map $host $og_desc {
    "~*traumabomen"  "Breng intergenerationeel trauma in kaart op visuele stambomen. Jouw data blijft van jou.";
    default          "Map intergenerational trauma onto visual family trees. Your data stays yours.";
}

map $host $og_origin {
    "~*traumabomen"  "https://www.traumabomen.nl";
    default          "https://www.traumatrees.org";
}

limit_req_zone $binary_remote_addr zone=auth_strict:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=auth_general:10m rate=20r/m;
limit_req_zone $binary_remote_addr zone=api_global:10m rate=120r/m;
limit_req_status 429;

server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    set_real_ip_from 169.254.0.0/16;
    set_real_ip_from 10.0.0.0/8;
    real_ip_header X-Forwarded-For;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;

    sub_filter_once off;
    sub_filter '__OG_LANG__'   $og_lang;
    sub_filter '__OG_LOCALE__' $og_locale;
    sub_filter '__OG_TITLE__'  $og_title;
    sub_filter '__OG_DESC__'   $og_desc;
    sub_filter '__OG_ORIGIN__' $og_origin;

    location = /healthz {
        access_log off;
        return 200;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
    }

    location ~ ^/api/auth/(login|register)$ {
        limit_req zone=auth_strict burst=3 nodelay;
        limit_req zone=api_global burst=30 nodelay;
        proxy_pass ${API_URL};
        proxy_ssl_server_name on;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/api/auth/ {
        limit_req zone=auth_general burst=5 nodelay;
        limit_req zone=api_global burst=30 nodelay;
        proxy_pass ${API_URL};
        proxy_ssl_server_name on;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api_global burst=30 nodelay;
        proxy_pass ${API_URL}/;
        proxy_ssl_server_name on;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note: The regex location blocks (`~ ^/api/auth/...`) use `proxy_pass ${API_URL}` without trailing slash because nginx does not strip the matched portion for regex locations (unlike prefix locations). The prefix `/api/` block keeps `proxy_pass ${API_URL}/` with trailing slash to strip the `/api/` prefix as before.

**Step 2: Verify nginx config syntax**

Run: `docker compose exec frontend nginx -t`
Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

If the test fails because `${API_URL}` is resolved at container start via envsubst, rebuild and restart:

Run: `docker compose up -d --build frontend`
Then: `docker compose exec frontend nginx -t`

**Step 3: Verify the app still works**

Run: `curl -s http://localhost:5173/api/health`
Expected: `{"status":"ok"}`

**Step 4: Commit**

```bash
git add frontend/nginx.conf
git commit -m "Add nginx rate limiting zones for auth and API endpoints"
```

---

### Task 4: Final verification

**Step 1: Run full backend test suite**

Run: `docker compose exec api uv run pytest -v`
Expected: All tests PASS

**Step 2: Run full frontend test suite**

Run: `docker compose exec frontend npx vitest run`
Expected: All tests PASS

**Step 3: Run type checkers**

Run: `docker compose exec api uv run mypy app/`
Run: `docker compose exec frontend npx tsc --noEmit`

**Step 4: Run security scans**

Run: `docker compose exec api uv run bandit -r app/`

**Step 5: Run coverage and quality gates**

Run: `make complexity`
Run: `make quality`

**Step 6: Commit all work (if any fixups needed)**

If any fixes were needed in steps 1-5, commit them.
