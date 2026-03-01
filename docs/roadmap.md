# Roadmap

## Assessment (February 2026)

The core product is solid: tree canvas, timeline, DSM classifications, pattern editor, life events, trauma events, zero-knowledge encryption, safety envelope. Quality infrastructure is excellent (97% frontend / 98% backend coverage with ratcheting, CodeQL, Nuclei, ZAP, privacy scanner, Lighthouse). CI/CD is mature with automated testing, multi-stage Docker builds, and post-deploy verification.

Two strategic gaps remain:

**1. Reflection gap.** The app is strong on mapping and visualization but thin on sense-making. There is great data entry, but limited tools to help users process what they have entered. The feature set is deficit-focused (trauma events, classifications, severity scores) without resilience or strengths. For practitioners like Mark Wolynn ("It Didn't Start with You"), the tool tells only half the story without a way to map cycle-breaking, healing, and protective factors.

**2. Scaling gap.** The app is configured for a private beta (20-user cap, blocking email, no error tracking). Rate limiting is in place; remaining hardening items must land before wider adoption.

Priority: reflection features first (they define the product), then scaling hardening (gates wider adoption).

## Planned: Reflection (high priority)

These features turn the tree from a diagram into a living reflection tool. The resilience layer is the single most important addition for practitioner credibility.

### ~~1. Resilience and strengths layer~~ (done)

### ~~2. Reflection journal~~ (done)

### ~~3. Guided reflection prompts~~ (done)

### 4. Personal insights summary

Read-only overview page per tree that surfaces basic observations from what the user already entered.

- "3 generations affected by addiction"
- "Loss events cluster around ages 30-40"
- "2 persons share the same classification"
- Not AI analysis; counting and grouping, presented as a reflection starting point

## Planned: Scaling hardening (high priority)

Required before growing beyond the current 20-user beta. These are infrastructure essentials, not polish.

### ~~5. API rate limiting~~ (done)

### ~~6. Production error tracking~~ (done)

### ~~7. User data export~~ (done)

### ~~8. Async email sending~~ (done)

## Planned: Features (medium priority)

### 9. Care providers

Track mental health professionals and institutes as their own nodes on the canvas, connected to persons via dedicated care edges. Opt-in per tree via "Enable care providers functionality" setting.

- **CareProvider nodes**: name, kind (professional/institute), role, optional modality, notes
- **CareRelationship edges**: link one provider to multiple persons with per-person care periods
- **CareProviderDetailPanel**: edit provider details and manage linked persons with periods
- **Timeline**: care periods render as strips below person life bars
- Visually distinct from family nodes (pill shape, teal/green, dotted edges)

See [design doc](plans/2026-02-15-care-providers-design.md).

### 10. Canvas annotations

Free-text sticky notes or arrows that users can place directly on the canvas between nodes. Sometimes the insight is spatial. Lighter than the pattern editor.

### 11. Read-only tree sharing

Share a tree with another user for viewing. Builds on the per-tree key architecture from the export milestone.

- Asymmetric key pair (X25519 or RSA-OAEP) generated at registration, private key encrypted with master key
- Sharer encrypts tree key with recipient's public key; stored in `TreeShare` model with permission level
- Recipient decrypts shared tree keys on unlock; shared trees appear alongside owned trees
- Server-side permission enforcement (viewer cannot write)
- Revoke access by deleting the share grant

Prerequisite: user data export (#7) must land first (per-tree keys, key ring).

### 12. Wellbeing check-in

Small optional prompt when opening the app: "How are you feeling right now?" Stored privately, shown over time as a personal trend. Reinforces the app as a self-care tool. Also a gentle session timer nudge: "You've been working for 45 minutes. Would you like to take a break?"

## Planned: Infrastructure (lower priority)

### 13. Passphrase hints and auth modals

User-written passphrase recovery hints, auth modal overlay replacing the unlock page redirect, and auto-lock on inactivity.

- **Passphrase hints**: optional hint stored server-side, shown during unlock
- **Auth modal**: full-viewport overlay with hero background, two modes (unlock / re-auth)
- **Auto-lock**: configurable inactivity timer (default 15 min) clears encryption key

See [design doc](plans/2026-02-15-passphrase-hints-auth-modals-design.md).

### 14. Passkey authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside email+password. Phishing-resistant authentication using biometrics, device PIN, or security keys. Encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org / traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

### 15. Cloud Run scaling configuration

Current settings are conservative for beta. Adjust before wider rollout.

- Increase `MAX_ACTIVE_USERS` from 20 to 200+
- Increase Cloud Run max-instances from 4 to 8-16
- ~~Set min-instances to 1 (eliminates 5-10s cold start latency)~~
- Increase DB connection pool: `pool_size=10, max_overflow=20`

### 16. Client-side virtualization

Large trees (500+ persons, 2000+ events) will cause rendering lag in timeline and event lists.

- Windowing library (react-window or similar) for timeline and long lists
- Viewport-aware rendering for React Flow canvas (already partially handled by @xyflow/react)
- Consider lazy-loading event details in PersonDetailPanel

### 17. Replace Dagre with elkjs and collapsible sub-trees

Replace Dagre layout engine with elkjs (the open-source engine behind React Flow Pro's auto-layout) and add collapsible ancestor/descendant sub-trees with compact summary nodes. Drop the React Flow Pro watermark suppression. See [design doc](plans/2026-02-26-elkjs-collapse-design.md).

### 18. Security hardening

Findings from the February 2026 security audit. Address before wider adoption.

**Frontend stability:**
- ~~React error boundaries on lazy-loaded route pages (single decrypt failure crashes entire app)~~
- ~~Wrap `decrypt()` calls in `useTreeData` queryFns so one corrupt blob does not block all data~~
- ~~Explicit `allowedElements` or `rehype-sanitize` config for react-markdown in journal preview~~
- ~~Verify interval cleanup on unmount in `VerificationPendingPage`~~

**Authentication:**
- ~~Client-side and server-side password strength validation (minimum length, complexity)~~
- ~~Refresh token rotation (single-use tokens to limit stolen-token window)~~
- ~~Constant-time passphrase hash comparison in `EncryptionContext` (replace `===` with timing-safe check)~~

**Backend hardening:**
- ~~Enforce DB connection SSL (`sslmode=require`) in production~~
- Verify production email always uses TLS
- Verify nginx or Cloud Run handles rate limiting on `POST /waitlist`, `POST /feedback`, `POST /auth/login`

## Done

### Beta waitlist and user cap

Configurable user cap with email-only waitlist. Admin approves from dashboard, triggering invitation emails. Controlled by `ENABLE_WAITLIST` and `MAX_ACTIVE_USERS` environment variables. [Design doc](plans/2026-02-17-beta-waitlist-design.md).

### Timeline view refinement

Full timeline redesign: dual-axis modes (years and age), three interaction layers (explore, edit, annotate), comprehensive filtering with smart person groups, pattern visualization (lane tints, marker rings, inline labels), partner relationship lines, zoom/pan, marker labels, gridlines, and timeline-specific settings panel. [Design docs](plans/2026-02-18-timeline-redesign-design.md), [pattern redesign](plans/2026-02-20-timeline-pattern-redesign.md), [settings](plans/2026-02-19-timeline-settings-design.md).

### In-app feedback form

Structured feedback (bug, feature, general) via modal in the footer. Stored in database, shown in admin dashboard with category badges, email notification to configurable address. Anonymous submission option. [Design doc](plans/2026-02-17-feedback-form-design.md).

### Pattern editor

Annotation layer linking trauma events, life events, and classifications across generations to mark recurring themes. Metaball contour visualization on the canvas, theme-aware colors, hover preview from panel, dedicated pattern view with edit-on-canvas navigation. [Design doc](plans/2026-02-16-pattern-editor-design.md).

### Resilience and strengths layer

New "Turning Point" event type for mapping resilience: cycle-breaking, protective relationships, recovery, achievement, positive change. Star-shaped badges on canvas, star markers on timeline, full CRUD in detail panel (grouped under Events tab with trauma and life events), pattern linking, demo tree entries, bulk sync support. [Design doc](plans/2026-02-21-resilience-layer-design.md).

### Async email sending

Centralized `send_email_background` helper wraps all email-sending functions in daemon threads with one retry after 5 seconds. Registration and resend-verification no longer block on SMTP; waitlist approval and feedback gained retry logic. Graceful degradation: endpoints return success immediately, user has "resend" button as fallback. [Design doc](plans/2026-02-23-async-email-design.md).

### Production error tracking

Sentry integration for both FastAPI backend (`sentry-sdk[fastapi]`) and React frontend (`@sentry/react`). Custom crypto error hierarchy (`CryptoError` base with `DecryptError`, `KeyDerivationError`, `PassphraseError`) for encryption failure tracking. Privacy safeguards: no PII, encrypted data stripped from request context, hashed user IDs. Source maps uploaded via `@sentry/vite-plugin` during production build. Error boundary with user-friendly fallback. [Design doc](plans/2026-02-23-error-tracking-design.md).

### User data export

Per-tree encryption keys with master-key-encrypted key ring, transparent client-side migration on first unlock, simplified passphrase change (re-encrypt key ring only). Encrypted JSON backup (download + re-import), plaintext JSON export with confirmation dialog. Life events and journal entries added to bulk sync endpoint. [Design doc](plans/2026-02-24-user-data-export-design.md).

### API rate limiting

Two-layer rate limiting: nginx (strict 5/min on login/register, general 20/min on auth, global 120/min) and application-layer progressive backoff on failed logins (tarpitting at 4+ attempts, lockout at 10, 30-min auto-expiry). In-memory tracking by IP and email with log injection protection. [Design doc](plans/2026-02-22-api-rate-limiting-design.md), [implementation plan](plans/2026-02-23-api-rate-limiting-plan.md).

### Safety envelope

Three-layer protection system: onboarding gate, safety footer, lock + blur screen. [Design doc](plans/2026-02-16-safety-envelope-design.md).

## Backlog

### Features
- OAuth/social login
- GEDCOM import/export
- PDF/image export (with filtering: choose which persons/events to include)
- Custom category management
- Collaborative/shared trees with edit permissions (extends read-only sharing, #11)
- Offline-first with service worker
- Additional languages beyond English and Dutch
- Family constellation ("familie opstelling") functionality with an "I" person node
- Import from major genealogy software
- List of mental health organizations per country
- Questionnaires for family members (no account needed, answers feed into the tree)

### Improvements
- Unknown birth year with approximation (before year, or decade)
- Call name / nickname for persons
- Directly add an adopted sibling shortcut

### To think about
- More themes
- Optional pet support
- Better loading/working notifications
- Swagger for FastAPI (dev only)
- More debug info on email sending
- Saved views
- Cloud Monitoring dashboards (API latency, error rates, DB connections)
- Read replicas for analytics queries (admin dashboard)
- CDN for frontend assets if serving globally
