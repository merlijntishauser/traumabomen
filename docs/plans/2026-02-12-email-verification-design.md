# Email Verification Design

Date: 2026-02-12

## Context

Traumabomen currently has no email verification. Registration immediately returns auth tokens and any string that looks like an email works. For the hosted version, we need email verification to prevent abuse, establish credibility, and lay groundwork for future email features (password reset, notifications). Self-hosted deployments can disable it via environment variable.

## Registration Flow

**When `REQUIRE_EMAIL_VERIFICATION=true`:**

1. User fills in email, password, passphrase (same form as today)
2. Backend creates user with `email_verified = false`, stores the encryption salt, but does not return auth tokens
3. Backend generates a signed verification token (random 32 bytes, URL-safe base64) and sends an email with a verification link
4. Frontend shows a "Check your email" screen with the registered email and a "Resend" button
5. User clicks the link -> backend sets `email_verified = true` -> redirects to login page
6. User logs in normally (existing flow)

**When `REQUIRE_EMAIL_VERIFICATION=false`:** Current behavior -- register returns tokens immediately, `email_verified` set to `true` automatically.

The passphrase and salt are collected at registration but key derivation + unlock happens after verification, at first login. No encrypted data exists yet, so nothing is stuck behind an unverified account.

## Backend Changes

### User model

Add two fields:
- `email_verified: bool = False`
- `email_verification_token: str | None` (stored as bcrypt hash)
- `email_verification_expires_at: datetime | None`

### Config settings

- `REQUIRE_EMAIL_VERIFICATION: bool = True`
- `SMTP_HOST: str`
- `SMTP_PORT: int = 587`
- `SMTP_USER: str`
- `SMTP_PASSWORD: str`
- `SMTP_FROM: str` (e.g. `noreply@traumabomen.app`)
- `APP_BASE_URL: str` (for building the verification link)

### Auth router changes

- `POST /auth/register` -- when verification required: create user, generate token, send email, return `201` with `{ message: "verification_email_sent" }` (no auth tokens). When not required: current behavior.
- `POST /auth/login` -- reject with `403` and `{ detail: "email_not_verified" }` if user exists, password correct, but `email_verified = false`.
- `GET /auth/verify?token=xxx` -- new endpoint. Validates token, sets `email_verified = true`, returns success JSON.
- `POST /auth/resend-verification` -- takes `{ email }`, regenerates token, resends email. Rate-limited: max 3 per hour per email.

### Verification token

Random 32-byte string, URL-safe base64 encoded. Stored as bcrypt hash. Expires after 24 hours.

### Email sending

Small `email.py` utility using Python's `smtplib` + `email.mime`. Single function: `send_verification_email(to, token, base_url)`.

## Frontend Changes

### New pages

**`VerificationPendingPage.tsx`** (`/verify-pending`):
- "We sent a verification email to **{email}**"
- "Resend" button (calls `POST /auth/resend-verification`, disabled 60s after click)
- "Back to login" link
- Same auth page layout (AuthHero, card styling)

**`VerifyEmailPage.tsx`** (`/verify`):
- Reads `token` from URL query params
- Calls `GET /auth/verify?token=xxx` on mount
- Spinner while verifying, then success with "Go to login" link
- On failure: error message with resend link

### Modified pages

**RegisterPage:** On success when API returns `verification_email_sent`, navigate to `/verify-pending` passing email as route state.

**LoginPage:** Handle `403 email_not_verified` -- show "Please verify your email" with resend link.

### i18n keys (EN + NL)

- `auth.verificationSent`
- `auth.resendVerification`
- `auth.resendSuccess`
- `auth.resendCooldown`
- `auth.verifying`
- `auth.verificationSuccess`
- `auth.verificationFailed`
- `auth.emailNotVerified`

## Scope

No changes to tree workspace, encryption flow, timeline, or any other pages. The encryption passphrase flow is unchanged -- it just happens at first login after verification instead of immediately at registration.
