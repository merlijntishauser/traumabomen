# Beta Waitlist with User Cap

Date: 2026-02-17

## Context

Traumabomen is preparing for a limited beta launch. To control growth and ensure quality, we need a user cap (configurable, default 20) with a waitlist for overflow. Users who try to register when the cap is reached join a waitlist by submitting their email. An admin can approve waitlisted users, which sends them an email with a registration link. The waitlist, approval, and cap are all new -- there is no existing approval mechanism in the codebase.

## Design Decisions

- **Email-only waitlist**: Waitlisted users submit only their email address. No account is created until they are approved and complete registration.
- **Approval email**: When an admin approves a waitlisted user, they receive an email with a link to complete registration.
- **Admin dashboard tab**: Waitlist management lives in the existing admin dashboard as a new tab.
- **Configurable cap**: `MAX_ACTIVE_USERS` environment variable (default `20`, `0` = unlimited/disabled).
- **Feature toggle**: `ENABLE_WAITLIST` environment variable (default `false`). When false, registration works exactly as today with no cap. When true, the cap and waitlist are active.

## Data Model

### New table: `waitlist_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, server-generated |
| `email` | String(255) | Unique, indexed |
| `status` | Enum: `waiting`, `approved`, `registered`, `rejected` | Default `waiting` |
| `invite_token` | String(255), nullable | SHA-256 hash of plaintext token (like email verification) |
| `invite_expires_at` | DateTime(tz), nullable | 7-day expiry from approval |
| `created_at` | DateTime(tz) | When they joined the waitlist |
| `approved_at` | DateTime(tz), nullable | When admin approved |
| `registered_at` | DateTime(tz), nullable | When they completed registration |

No FK to `users` -- the waitlist entry exists before any user account. The `email` column connects them logically. Status transitions: `waiting` -> `approved` -> `registered` (happy path), or `waiting` -> `rejected`.

## Backend Changes

### Config (`api/app/config.py`)

Add:
- `ENABLE_WAITLIST: bool = False`
- `MAX_ACTIVE_USERS: int = 20`

### New model (`api/app/models/waitlist.py`)

SQLAlchemy model for `waitlist_entries` table. New `WaitlistStatus` enum.

### Model registry (`api/app/models/__init__.py`)

Import `WaitlistEntry` so Alembic sees it.

### New Alembic migration

Create `waitlist_entries` table.

### New router (`api/app/routers/waitlist.py`)

Public endpoints:
- `POST /waitlist` -- submit email to join waitlist. Validates: email not already on waitlist, email not already registered as a user. Returns 201 with message. If waitlist is disabled or cap not reached, returns 409 telling them to register normally.
- `GET /waitlist/status?email=xxx` -- check waitlist status (waiting/approved/rejected). Returns 404 if not found. Public so the frontend can show status.

Admin endpoints (require `require_admin`):
- `GET /admin/waitlist` -- list all waitlist entries with counts by status.
- `PATCH /admin/waitlist/{id}/approve` -- set status to `approved`, generate invite token (random 32 bytes, store SHA-256 hash), set 7-day expiry, send approval email. Returns the entry.
- `PATCH /admin/waitlist/{id}/reject` -- set status to `rejected`. Returns the entry.

### Registration flow changes (`api/app/routers/auth.py`)

Modify `POST /auth/register`:
1. If `ENABLE_WAITLIST` is true, count active users (verified users). If count >= `MAX_ACTIVE_USERS`:
   - Return 403 with `{ detail: "registration_closed", waitlist_url: "/waitlist" }` -- tells frontend to redirect to waitlist.
2. If request includes an `invite_token` query param:
   - Look up waitlist entry with matching token hash and status `approved`
   - Validate token not expired
   - Validate email matches the waitlist entry email
   - Mark entry as `registered` with timestamp
   - Proceed with normal registration
3. If no invite token and cap not reached: normal registration (existing behavior).

### New email templates (`api/app/email.py`)

Add `send_waitlist_approval_email(to, token, settings)`:
- Subject: "You're in! Complete your Traumabomen registration"
- Body: approval message + registration link: `{APP_BASE_URL}/register?invite={token}`
- Same SMTP setup as verification email.

Also add `send_waitlist_confirmation_email(to, settings)`:
- Subject: "You're on the Traumabomen waitlist"
- Body: confirmation that they're on the list, we'll email when a spot opens.

### Capacity helper

Add a utility function `get_active_user_count(db)` and `is_registration_open(db, settings)` to avoid duplicating the cap check logic across endpoints.

## Frontend Changes

### New page: `WaitlistPage.tsx` (`/waitlist`)

Simple page matching the auth page layout (AuthHero, card styling):
- Email input field
- "Join waitlist" button
- On success: show confirmation message ("You're on the list. We'll email you when a spot opens.")
- If already on waitlist: show current status
- If waitlist is disabled: redirect to `/register`

### Modified: `RegisterPage.tsx`

- Read `invite` query param from URL
- If present, pass it to the register API call
- If registration returns 403 `registration_closed`, navigate to `/waitlist`
- Show a subtle banner at top when registering via invite: "You've been approved! Complete your registration below."

### New admin tab: Waitlist management

Add to `AdminPage.tsx`:
- New "Waitlist" tab alongside existing analytics tabs
- Table showing waitlist entries: email, status, joined date, approved date
- "Approve" and "Reject" buttons per entry
- Count badges: "X waiting, Y approved, Z registered"
- Show current capacity: "N / MAX_ACTIVE_USERS active users"

### API client (`frontend/src/lib/api.ts`)

Add functions:
- `joinWaitlist(email)` -- POST /waitlist
- `getWaitlistStatus(email)` -- GET /waitlist/status
- `getAdminWaitlist()` -- GET /admin/waitlist
- `approveWaitlistEntry(id)` -- PATCH /admin/waitlist/{id}/approve
- `rejectWaitlistEntry(id)` -- PATCH /admin/waitlist/{id}/reject

### i18n keys (EN + NL)

New keys under `waitlist.*`:
- `waitlist.title`, `waitlist.subtitle`
- `waitlist.emailPlaceholder`, `waitlist.joinButton`
- `waitlist.success`, `waitlist.alreadyOnList`
- `waitlist.statusWaiting`, `waitlist.statusApproved`, `waitlist.statusRejected`
- `waitlist.registrationClosed`, `waitlist.registrationClosedDescription`
- `waitlist.approvalBanner`

Admin keys under `admin.waitlist.*`:
- `admin.waitlist.title`, `admin.waitlist.approve`, `admin.waitlist.reject`
- `admin.waitlist.statusFilter`, `admin.waitlist.capacity`

## Files to Create

| File | Purpose |
|---|---|
| `api/app/models/waitlist.py` | WaitlistEntry model + WaitlistStatus enum |
| `api/app/routers/waitlist.py` | Public + admin waitlist endpoints |
| `api/alembic/versions/xxxx_add_waitlist_table.py` | Migration |
| `frontend/src/pages/WaitlistPage.tsx` | Waitlist signup page |

## Files to Modify

| File | Change |
|---|---|
| `api/app/config.py` | Add `ENABLE_WAITLIST`, `MAX_ACTIVE_USERS` |
| `api/app/models/__init__.py` | Import WaitlistEntry |
| `api/app/email.py` | Add approval + confirmation email functions |
| `api/app/routers/auth.py` | Cap check on registration, invite token validation |
| `api/app/routers/__init__.py` or `api/app/main.py` | Register waitlist router |
| `frontend/src/lib/api.ts` | Waitlist API functions |
| `frontend/src/pages/RegisterPage.tsx` | Invite token handling, cap redirect |
| `frontend/src/pages/AdminPage.tsx` | Waitlist management tab |
| `frontend/src/locales/en/translation.json` | English waitlist strings |
| `frontend/src/locales/nl/translation.json` | Dutch waitlist strings |
| `frontend/src/App.tsx` (or router config) | Add `/waitlist` route |
| `.env.example` | Add new env vars |

## Implementation Order

1. Backend model + migration
2. Config settings
3. Email templates (approval + confirmation)
4. Waitlist router (public + admin endpoints)
5. Auth router modifications (cap check + invite token)
6. Backend tests
7. Frontend API client functions
8. WaitlistPage
9. RegisterPage modifications
10. AdminPage waitlist tab
11. i18n strings (EN + NL)
12. Frontend tests
13. End-to-end verification

## Verification

1. `docker compose exec api uv run pytest` -- all backend tests pass
2. `docker compose exec frontend npx vitest run` -- all frontend tests pass
3. `docker compose exec frontend npx tsc --noEmit` -- no type errors
4. `docker compose exec api uv run mypy app/` -- no type errors
5. `docker compose exec api uv run bandit -r app/` -- no security issues
6. Manual flow test:
   - Set `ENABLE_WAITLIST=true`, `MAX_ACTIVE_USERS=1`
   - Register one user (should succeed normally)
   - Try to register another -- should get redirected to waitlist
   - Submit email on waitlist page
   - Approve via admin dashboard
   - Complete registration via invite link in email
