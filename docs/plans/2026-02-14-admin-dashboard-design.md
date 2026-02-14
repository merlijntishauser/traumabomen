# Admin Dashboard

## Context

The app has no visibility into how it's being used. We need a lightweight admin dashboard to answer three questions: how many people are signing up, are they coming back, and how deeply are they engaging? The dashboard lives inside the existing React app behind an admin gate, accessible only to maintainers.

All metrics are derived from structural metadata (timestamps, row counts). No encrypted user data is accessed or decrypted.

## Data Layer

### Schema Changes

Add a column to the `users` table:

```
is_admin: Boolean, default False, not null
```

This gates access to admin API routes. Set manually via SQL after deploying the migration.

Add a new `login_events` table:

```
id:        UUID (PK)
user_id:   UUID (FK -> users, ON DELETE CASCADE)
logged_at: timestamptz (server default: now())
```

Index on `logged_at` for time-range queries. One row inserted per successful `/auth/login` call. The FK cascade cleans up login history when a user is deleted.

### Migration

Single Alembic migration that adds the `is_admin` column and creates the `login_events` table. After deploying, set your own account as admin with a manual `UPDATE users SET is_admin = true WHERE email = '...'`.

## API

### Auth Guard

A FastAPI dependency `require_admin` that wraps `get_current_user` and raises `HTTPException(403)` if `is_admin` is false.

Add `is_admin` to the JWT access token claims so the frontend can gate UI without an extra API call.

### Recording Login Events

In the existing `/auth/login` endpoint, insert a row into `login_events` after successful authentication. No new endpoint needed.

### Admin Endpoints

New router `routers/admin.py` with three endpoints, all guarded by `require_admin`.

**`GET /admin/stats/overview`**

```json
{
  "total_users": 142,
  "verified_users": 128,
  "signups": { "day": 3, "week": 18, "month": 52 },
  "active_users": { "day": 12, "week": 45, "month": 89 }
}
```

- `total_users` / `verified_users`: count from `users` table.
- `signups`: count of `users.created_at` within each period.
- `active_users`: distinct `user_id` from `login_events` within each period.

**`GET /admin/stats/retention?weeks=12`**

```json
{
  "cohorts": [
    { "week": "2026-01-05", "signup_count": 14, "retention": [100, 57, 43, 36] }
  ]
}
```

- Groups users by `DATE_TRUNC('week', users.created_at)`.
- Joins against `login_events` to compute which subsequent weeks each user was active.
- `retention[n]` is the percentage of the cohort that logged in during week n after signup.
- `weeks` param controls how many cohort weeks to return (default 12).

**`GET /admin/stats/usage`**

```json
{
  "persons": { "0": 5, "1-2": 12, "3-5": 18, "6-10": 8, "11-20": 3, "20+": 1 },
  "relationships": { "0": 8, "1-2": 15, "3-5": 12, "6-10": 6, "11-20": 2, "20+": 0 },
  "events": { "0": 10, "1-2": 14, "3-5": 11, "6-10": 5, "11-20": 1, "20+": 0 }
}
```

- `COUNT(*) GROUP BY tree_id` for persons, relationships, and events tables, bucketed server-side into fixed ranges.

## Frontend

### Routing & Access

New route `/admin` inside the authenticated layout. The route checks `is_admin` from the JWT token claims -- if false, redirects to `/trees`. A small "Admin" link in the nav bar is only rendered when `is_admin` is true.

### Dashboard Layout

Single page, no sub-routes. Three TanStack Query fetches fire in parallel on mount.

**Overview cards (top row):**

Four stat cards in a horizontal row:

| Card | Content |
|------|---------|
| Total users | Count + verified count |
| Signups this week | Number |
| Signups this month | Number |
| Active users | DAU / WAU / MAU as three numbers |

**Retention cohort table (middle):**

HTML table. Rows are signup cohorts by week, columns are "week 0, week 1, week 2, ...". Cells show the retention percentage and are shaded by intensity -- darker green for higher retention. This is the core view for understanding whether users come back.

**Usage depth (bottom):**

Three bar charts (or histogram tables) showing the distribution of persons-per-tree, relationships-per-tree, and events-per-tree across the fixed buckets (0, 1-2, 3-5, 6-10, 11-20, 20+). Shows whether users are building real trees or just trying the app briefly.

### i18n

Admin dashboard strings are English-only. No Dutch translations needed -- this is a maintainer-facing tool.

## Files to Create/Modify

| # | File | Change |
|---|------|--------|
| 1 | `api/app/models/user.py` | Add `is_admin` column |
| 2 | `api/app/models/login_event.py` | New model |
| 3 | `api/alembic/versions/xxx_add_admin_dashboard.py` | Migration |
| 4 | `api/app/routers/auth.py` | Record login event, add `is_admin` to JWT claims |
| 5 | `api/app/auth.py` | Include `is_admin` in token payload, add `require_admin` dependency |
| 6 | `api/app/routers/admin.py` | New router with three stats endpoints |
| 7 | `api/app/main.py` | Register admin router |
| 8 | `frontend/src/components/admin/AdminDashboard.tsx` | Dashboard page |
| 9 | `frontend/src/components/admin/AdminDashboard.css` | Styles |
| 10 | `frontend/src/hooks/useAdminStats.ts` | TanStack Query hooks for admin endpoints |
| 11 | `frontend/src/App.tsx` (or router config) | Add `/admin` route |
| 12 | `frontend/src/components/nav/` | Conditional "Admin" link |
| 13 | `frontend/src/locales/en/translation.json` | Admin UI strings |
