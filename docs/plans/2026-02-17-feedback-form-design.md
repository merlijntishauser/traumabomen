# In-App Feedback Form

## Context

The app has 3 users. We want a lightweight way to collect structured feedback
(bugs, feature requests, general) without pulling users out of the app. Feedback
should be stored in the database, shown in the admin dashboard, and trigger an
email notification.

## Data Model

New `feedback` table (unencrypted -- operational data):

| Column       | Type      | Notes                                    |
|------------- |---------- |----------------------------------------- |
| id           | UUID      | Primary key                              |
| user_id      | UUID      | Nullable. Null when submitted anonymously |
| category     | varchar   | `bug`, `feature`, `general`              |
| message      | text      | Required, max 2000 chars                 |
| created_at   | timestamp | Server-set                               |

Foreign key: `user_id -> users.id` (on delete set null).

## API

### `POST /feedback`

Auth required (prevents spam). Body:

```json
{
  "category": "bug" | "feature" | "general",
  "message": "string (1-2000 chars)",
  "anonymous": true | false
}
```

When `anonymous` is true, store `user_id` as null. Returns 201.

Side effect: send email to `feedback@traumatrees.org`.

### `GET /admin/feedback`

Admin-guarded. Returns all feedback entries sorted newest-first. Each entry
includes: id, category, message, user email (or null), created_at.

No pagination needed at current volume.

## Email Notification

On each submission, send a plain text email to `feedback@traumatrees.org` using
the existing `email.py` infrastructure.

- **Subject:** `[Feedback] {Category} from {user email or "Anonymous"}`
- **Body:** Message text, category, and timestamp.

## Frontend

### Footer link

Add a "Feedback" link to `AppFooter`, next to the privacy policy link. Same
styling and height.

### Feedback modal

Centered modal (not a side panel). Contents:

- **Category:** Three radio buttons -- Bug report, Feature request, General
  feedback. Default: General feedback.
- **Message:** Textarea with placeholder "Tell us what's on your mind...".
  Max 2000 characters with a visible character counter.
- **Anonymous toggle:** Checkbox "Submit anonymously" with note: "We won't be
  able to follow up if you submit anonymously."
- **Submit button:** Primary style, disabled until message is non-empty.
- **Success state:** After submit, replace form with "Thank you for your
  feedback" message. Auto-close after 3 seconds.

All strings translated EN + NL.

### Admin view

New section in the admin dashboard. Simple list showing:

- Date
- Category (colored badge: red = bug, blue = feature, gray = general)
- Message (truncated to ~100 chars, expandable on click)
- User email or "Anonymous"

Sorted newest-first.

## What does NOT change

- Encryption model (feedback is not sensitive tree data)
- Existing admin dashboard structure (new section added alongside existing ones)
- Authentication flow
