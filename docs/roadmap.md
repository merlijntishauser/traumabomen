# Roadmap

## Assessment (March 2026)

The core product is solid: tree canvas, timeline, DSM classifications, pattern editor, life events, trauma events, turning points (resilience), reflection journal with guided prompts, zero-knowledge encryption, safety envelope. Quality infrastructure is excellent (97% frontend / 98% backend coverage with ratcheting, CodeQL, Nuclei, ZAP, privacy scanner, Lighthouse). CI/CD is mature with automated testing, multi-stage Docker builds, and post-deploy verification.

The two strategic gaps identified in February are now largely resolved:

**Reflection gap: closed.** Resilience layer, reflection journal, guided prompts, and personal insights summary are all shipped. The reflection story is complete.

**Scaling gap: closed.** Rate limiting, error tracking, user data export, async email, and all security hardening items from the February audit are done. The remaining scaling work is operational (Cloud Run configuration, connection pools) and can be adjusted as needed when growing beyond 20 users.

Priority: ship high-impact UX features that make the tree more useful for everyday work.

## ~~Planned: Reflection~~ (done)

### ~~1. Resilience and strengths layer~~ (done)

### ~~2. Reflection journal~~ (done)

### ~~3. Guided reflection prompts~~ (done)

### ~~4. Personal insights summary~~ (done)

## ~~Planned: Scaling hardening~~ (done)

### ~~5. API rate limiting~~ (done)

### ~~6. Production error tracking~~ (done)

### ~~7. User data export~~ (done)

### ~~8. Async email sending~~ (done)

## Planned: Features (medium priority)

### 9. Canvas annotations

Free-positioned sticky notes on the canvas for spatial observations. Six muted colors for visual grouping. Double-click canvas or toolbar button to create, inline editing with color picker. Encrypted text, plaintext position. New Annotation entity with CRUD endpoints and bulk sync support.

See [design doc](plans/2026-03-02-canvas-annotations-design.md).

### ~~10. Sibling groups~~ (done)

### 11. Read-only tree sharing

Share a tree with another user for viewing. Builds on the per-tree key architecture from the export milestone.

- RSA-OAEP 4096-bit key pair generated per user on first unlock, private key encrypted with master key
- Sharer encrypts tree key with recipient's public key; stored in `TreeShare` model
- Pending shares for non-registered recipients: invite email sent, auto-completed when recipient creates account
- Recipient decrypts shared tree keys on unlock; shared trees appear in separate "Shared with me" section
- Server-side read-only enforcement (viewer can GET but not POST/PUT/DELETE); journal entries excluded
- Display name field for user identity in shares
- Revoke access by deleting the share grant

See [design doc](plans/2026-03-01-read-only-tree-sharing-design.md). Prerequisite: user data export (#7).

### 12. Care providers

Track mental health professionals and institutes as their own nodes on the canvas, connected to persons via dedicated care edges. Opt-in per tree via "Enable care providers functionality" setting.

- **CareProvider nodes**: name, kind (professional/institute), role, optional modality, notes
- **CareRelationship edges**: link one provider to multiple persons with per-person care periods
- **CareProviderDetailPanel**: edit provider details and manage linked persons with periods
- **Timeline**: care periods render as strips below person life bars
- Visually distinct from family nodes (pill shape, teal/green, dotted edges)

See [design doc](plans/2026-02-15-care-providers-design.md).

### 13. Wellbeing check-in

Small optional prompt when opening the app: "How are you feeling right now?" Stored privately, shown over time as a personal trend. Reinforces the app as a self-care tool. Also a gentle session timer nudge: "You've been working for 45 minutes. Would you like to take a break?"

## Planned: Infrastructure (lower priority)

### ~~14. Passphrase hints and auth modals~~ (done)

### 15. Passkey authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside email+password. Phishing-resistant authentication using biometrics, device PIN, or security keys. Encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org / traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

### 16. Cloud Run scaling configuration

Current settings are conservative for beta. Adjust before wider rollout.

- Increase `MAX_ACTIVE_USERS` from 20 to 200+
- Increase Cloud Run max-instances from 4 to 8-16
- ~~Set min-instances to 1 (eliminates 5-10s cold start latency)~~
- Increase DB connection pool: `pool_size=10, max_overflow=20`

### 17. Client-side virtualization

Large trees (500+ persons, 2000+ events) will cause rendering lag in timeline and event lists.

- Windowing library (react-window or similar) for timeline and long lists
- Viewport-aware rendering for React Flow canvas (already partially handled by @xyflow/react)
- Consider lazy-loading event details in PersonDetailPanel

### 18. Replace Dagre with elkjs and collapsible sub-trees

Replace Dagre layout engine with elkjs (the open-source engine behind React Flow Pro's auto-layout) and add collapsible ancestor/descendant sub-trees with compact summary nodes. Drop the React Flow Pro watermark suppression. See [design doc](plans/2026-02-26-elkjs-collapse-design.md).

### 19. Post-deploy e2e smoketest

Run a Playwright smoketest subset against the live production URL after each deploy. Reuses the `@smoketest`-tagged e2e tests (auth flow, tree workflow with encryption round-trip) via `E2E_SMOKETEST=true` and `E2E_BASE_URL` pointing to the production domain. Replaces the current curl-based health check in the deploy workflow. Requires wiring production test credentials into the deploy workflow secrets.

## Done

### Security hardening

Findings from the February 2026 security audit, all resolved.

**Frontend stability:** React error boundaries on lazy-loaded route pages, resilient decrypt() calls in useTreeData (Promise.allSettled), allowedElements for react-markdown in journal preview, interval cleanup on unmount in VerificationPendingPage.

**Authentication:** Client-side and server-side password strength validation, refresh token rotation (single-use tokens), constant-time passphrase hash comparison.

**Backend hardening:** DB connection SSL enforcement in production, production email TLS verification, rate limiting on auth and public endpoints.

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

### Personal insights summary

Read-only overview page at `/trees/:id/insights` surfacing basic observations from entered data. Four insight categories: generational patterns (recurring trauma/classifications across generations), temporal clustering (age-at-event patterns, dense year windows), category summaries (most common trauma type, total counts, shared classifications), resilience indicators (turning points following trauma, cycle-breaking). All computation client-side, card grid layout, no AI. [Design doc](plans/2026-03-01-personal-insights-design.md).

### Sibling groups

Compact representation of siblings without creating full Person nodes. SiblingGroup entity with lightweight member records (name, optional birth year) alongside full Person references. Pill-shaped nodes on the canvas connected to shared parents. Members promotable to full persons with sibling relationships in a single bulk sync call. One group per person constraint (server-side 409). Detail panel for editing members, section in RelationshipsTab. [Design doc](plans/2026-03-02-sibling-groups-design.md).

### Passphrase hints and auth modals

User-written passphrase recovery hints, auth modal overlay, and auto-lock on inactivity. Optional hint (max 255 chars) stored server-side, shown on unlock page and auth modal. Auth modal is a full-viewport overlay with hero background in two modes (unlock for expired encryption key, re-auth for expired JWT). Auto-lock with configurable inactivity timer (5/15/30/60 min or disabled) clears encryption key. Hint manageable in account settings. [Design doc](plans/2026-02-15-passphrase-hints-auth-modals-design.md).

### Safety envelope

Three-layer protection system: onboarding gate, safety footer, lock + blur screen. [Design doc](plans/2026-02-16-safety-envelope-design.md).

## Backlog

### Features
- OAuth/social login
- GEDCOM import/export
- PDF/image export (with filtering: choose which persons/events to include)
- Custom category management
- Edit permissions for shared trees (extends read-only sharing, #11)
- Share links for non-registered users (extends read-only sharing, #11)
- Out-of-band key fingerprint verification for shared tree key exchange
- Collaborative real-time editing (extends edit permissions)
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
- Relationship prompt after person creation ([design doc](plans/2026-02-18-relationship-prompt-design.md), partially implemented)
- Full birth/death dates ([design doc](plans/2026-02-17-full-birth-death-dates-design.md), partially implemented)

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
- Global events... not tied to a person, but visible in the timeline view and personal timeline. Think of COVID-19, WW-2, etc.
