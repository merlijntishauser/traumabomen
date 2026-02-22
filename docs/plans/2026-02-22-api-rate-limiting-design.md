# API Rate Limiting Design

## Overview

Two-layer rate limiting: nginx for coarse IP-based throttling (stops volumetric attacks before they reach Python), application layer for intelligent login backoff (tracks failed attempts by IP and email, tarpits attackers).

## Layer 1: Nginx

Three `limit_req_zone` directives keyed by `$binary_remote_addr`:

| Zone | Endpoints | Rate | Burst | Purpose |
|---|---|---|---|---|
| `auth_strict` | `/api/auth/login`, `/api/auth/register` | 5 req/min per IP | 3 | Brute-force prevention |
| `auth_general` | `/api/auth/*` (other auth routes) | 20 req/min per IP | 5 | General auth abuse |
| `api_global` | `/api/*` (everything) | 120 req/min per IP | 30 | Safety net against DoS |

Added to `nginx.conf` in the `http` block:

```nginx
limit_req_zone $binary_remote_addr zone=auth_strict:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=auth_general:10m rate=20r/m;
limit_req_zone $binary_remote_addr zone=api_global:10m rate=120r/m;
limit_req_status 429;
```

The existing `/api/` location block is restructured into three blocks (most specific first):

```nginx
location ~ ^/api/auth/(login|register)$ {
    limit_req zone=auth_strict burst=3 nodelay;
    limit_req zone=api_global burst=30 nodelay;
    proxy_pass http://api:8000;
}

location ~ ^/api/auth/ {
    limit_req zone=auth_general burst=5 nodelay;
    limit_req zone=api_global burst=30 nodelay;
    proxy_pass http://api:8000;
}

location /api/ {
    limit_req zone=api_global burst=30 nodelay;
    proxy_pass http://api:8000;
}
```

All three carry over existing proxy headers (`X-Forwarded-For`, etc.). `nodelay` serves burst requests immediately but counts them against the rate. The `10m` shared memory zone holds ~160,000 IP addresses.

## Layer 2: Application (login backoff)

### Module: `app/rate_limiter.py`

In-memory storage with two dicts tracking failed attempts:

```python
_by_ip: dict[str, AttemptRecord]    # { "1.2.3.4": { attempts: 7, last_attempt: datetime } }
_by_email: dict[str, AttemptRecord] # { "user@x.com": { attempts: 3, last_attempt: datetime } }
```

### Functions

- `record_failure(ip, email)`: increment both counters, update timestamp
- `check_and_tarpit(ip, email)`: look up the worse of the two counters, sleep accordingly, raise `HTTPException(429)` if locked out
- `clear(ip, email)`: called on successful login, resets both counters
- `_cleanup()`: called every 100 checks, evicts entries older than 30 minutes

### Tarpit schedule

Based on whichever counter (IP or email) is higher:

| Attempts | Action |
|---|---|
| 1-3 | None |
| 4-6 | `asyncio.sleep(5)` |
| 7-9 | `asyncio.sleep(30)` |
| 10+ | Immediate `429` with `Retry-After: 900` (15 min lockout) |

Entries auto-expire after 30 minutes of no new attempts. Thread safety is not needed: FastAPI runs async on a single event loop, and `asyncio.sleep` yields control without blocking other requests.

### Login endpoint integration

Three additions to `app/routers/auth.py`:

```python
from app.rate_limiter import check_and_tarpit, record_failure, clear

@router.post("/login")
async def login(request: Request, data: LoginRequest, db: ...):
    await check_and_tarpit(request.client.host, data.email)  # may tarpit or 429

    user = await get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        record_failure(request.client.host, data.email)
        raise HTTPException(401, "invalid_credentials")

    clear(request.client.host, data.email)  # success resets counters
    # ... rest of login
```

`check_and_tarpit` runs before authentication so a locked-out IP/email must wait even if the credentials are correct (prevents timing-based password discovery).

### Logging

Each tarpit and lockout event logs at `WARNING` level with:
- IP with last octet redacted (e.g., `1.2.3.x`)
- Email domain only (e.g., `*@example.com`)

Enough for monitoring without being a privacy concern.

## Testing

### Unit tests (`rate_limiter.py`)

- No delay under threshold (3 failures)
- Tarpit at 4 failures (assert `asyncio.sleep(5)`)
- Tarpit at 7 failures (assert `asyncio.sleep(30)`)
- Lockout at 10 failures (assert `HTTPException(429)` with `Retry-After`)
- `clear()` resets both IP and email counters
- IP and email tracked separately (different IPs hitting same email accumulates on email counter)
- Cleanup evicts entries older than 30 minutes
- Lockout expires after 30 min of no attempts

### Integration tests (login endpoint)

- 10 failed logins, 11th returns `429`
- Fail 5 times, succeed, fail again: counter starts fresh

### Nginx

Verified manually during deployment. Existing Nuclei security scanner can be extended with rate-limit checks.

## Out of scope

- Rate limiting on CRUD endpoints beyond global nginx throttle
- Per-user (authenticated) rate limiting
- Admin dashboard for viewing rate limit events
- Distributed rate limiting (Redis); needed when scaling to multiple instances
- CAPTCHA or proof-of-work challenges

## No frontend changes

The frontend already handles `429` responses from the resend-verification flow. No UI changes needed.
