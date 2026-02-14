# Admin Dashboard v2: Funnel, Growth, Activity, User List

## Context

The initial admin dashboard (overview cards, retention cohorts, usage depth) is deployed and working. This extension adds four more views to deepen insight into user behavior: a signup funnel, a cumulative growth chart, a login activity heatmap, and a user metadata table.

No schema changes needed -- all data is derivable from existing tables (`users`, `login_events`, `trees`, `persons`, `relationships`, `trauma_events`).

## API Endpoints

Four new endpoints in the existing `routers/admin.py`, all behind `require_admin`.

### `GET /admin/stats/funnel`

```json
{
  "registered": 142,
  "verified": 128,
  "created_tree": 94,
  "added_person": 76,
  "added_relationship": 52,
  "added_event": 31
}
```

Each step counts users who reached that stage: registered (all users), verified email, created at least one tree, have a tree with at least one person, etc. Derived from FK joins across existing tables.

### `GET /admin/stats/activity`

```json
{
  "cells": [
    { "day": 0, "hour": 9, "count": 14 },
    { "day": 0, "hour": 10, "count": 22 }
  ]
}
```

Groups `login_events.logged_at` by day-of-week (0=Monday, 6=Sunday) and hour (0-23). Returns only non-zero cells.

### `GET /admin/stats/growth`

```json
{
  "points": [
    { "date": "2026-01-15", "total": 12 },
    { "date": "2026-01-16", "total": 15 }
  ]
}
```

One point per day that had at least one signup, with cumulative running total. Sorted chronologically.

### `GET /admin/stats/users`

```json
{
  "users": [
    {
      "id": "6bf23d4c-...",
      "email": "user@example.com",
      "created_at": "2026-01-15T10:30:00Z",
      "email_verified": true,
      "last_login": "2026-02-13T14:22:00Z",
      "tree_count": 1,
      "person_count": 12,
      "relationship_count": 8,
      "event_count": 5
    }
  ]
}
```

All users, sorted by `created_at` descending. No pagination (user count is small). `last_login` is the most recent `login_events.logged_at` for that user (null if never logged in after the tracking was added). Entity counts are summed across all of the user's trees.

## Frontend

Four new sections added to the existing `AdminPage.tsx`. Page section order becomes:

1. Overview cards (existing)
2. Signup funnel (new)
3. Growth chart (new)
4. Activity heatmap (new)
5. Retention cohort table (existing)
6. Usage depth (existing)
7. User list (new)

### Signup Funnel

Horizontal bar chart. Each stage is a row: label on the left, proportional bar, count and percentage (relative to "registered") on the right. Reuses the same CSS bar pattern as usage depth histograms.

### Growth Chart

SVG line chart rendered with D3 (already a dependency). X-axis: dates. Y-axis: cumulative users. ~200px tall, full content width. Simple and static -- no hover tooltips or interactivity.

### Activity Heatmap

CSS grid, 7 rows (Mon-Sun) by 24 columns (0h-23h). Each cell colored by login count intensity using the same green scale as the retention table. Row labels are day abbreviations, column headers are hour numbers.

### User List

HTML table at the bottom. Columns: email, signed up, last login, verified, trees, persons, relationships, events. Sorted by signup date (newest first). No pagination or filtering.

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `api/app/routers/admin.py` | Add four new endpoints |
| 2 | `api/app/schemas/admin.py` | Add response models for new endpoints |
| 3 | `frontend/src/types/api.ts` | Add TypeScript interfaces |
| 4 | `frontend/src/lib/api.ts` | Add API client functions |
| 5 | `frontend/src/pages/AdminPage.tsx` | Add four new sections |
| 6 | `frontend/src/styles/admin.css` | Add styles for funnel, heatmap, growth chart, user table |
