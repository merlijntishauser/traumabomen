# Roadmap

## Assessment (February 2026)

The core product is solid: tree canvas, timeline, DSM classifications, pattern editor, life events, trauma events, zero-knowledge encryption, safety envelope. Quality infrastructure is excellent (97% frontend / 98% backend coverage with ratcheting, CodeQL, Nuclei, ZAP, privacy scanner, Lighthouse). CI/CD is mature with automated testing, multi-stage Docker builds, and post-deploy verification.

Two strategic gaps remain:

**1. Reflection gap.** The app is strong on mapping and visualization but thin on sense-making. There is great data entry, but limited tools to help users process what they have entered. The feature set is deficit-focused (trauma events, classifications, severity scores) without resilience or strengths. For practitioners like Mark Wolynn ("It Didn't Start with You"), the tool tells only half the story without a way to map cycle-breaking, healing, and protective factors.

**2. Scaling gap.** The app is configured for a private beta (20-user cap, no rate limiting, blocking email, no error tracking). Infrastructure can handle 100+ users with configuration changes, but several hardening items must land first.

Priority: reflection features first (they define the product), then scaling hardening (gates wider adoption).

## Planned: Reflection (high priority)

These features turn the tree from a diagram into a living reflection tool. The resilience layer is the single most important addition for practitioner credibility.

### ~~1. Resilience and strengths layer~~ (done)

### 2. Reflection journal

Per-tree journal with timestamped entries. Not a generic diary; entries that can optionally link to specific persons, events, patterns, or classifications. The connective tissue between the data and the meaning.

- Chronological list in a slide-out panel or dedicated view
- Optional entity linking ("Today I realized my grandmother's displacement mirrors my own feeling of never belonging")
- Rich text or markdown for longer entries
- Encrypted client-side like all other content

### 3. Guided reflection prompts

Small curated library of optional prompts that help users explore their tree more deeply. Available as starting points for journal entries.

- "Who in your family tree do you most identify with, and why?"
- "What event had the most ripple effects across generations?"
- "Are there strengths or resilience patterns, not just trauma?"
- "What patterns do you notice repeating?"
- Static, curated; not AI-generated

### 4. Personal insights summary

Read-only overview page per tree that surfaces basic observations from what the user already entered.

- "3 generations affected by addiction"
- "Loss events cluster around ages 30-40"
- "2 persons share the same classification"
- Not AI analysis; counting and grouping, presented as a reflection starting point

## Planned: Scaling hardening (high priority)

Required before growing beyond the current 20-user beta. These are infrastructure essentials, not polish.

### 5. API rate limiting

Login, registration, and all endpoints are currently unthrottled. A single bad actor could brute-force auth or DoS the API.

- Rate limiting middleware (slowapi or custom) on auth endpoints at minimum
- Progressive backoff on failed login attempts
- Consider tarpitting scheme for login brute-force
- Global request throttle as a safety net

### 6. Production error tracking

At 20 users, Cloud Run logs are sufficient. At 100+, aggregated error alerts are essential.

- Integrate Sentry (or equivalent) for both frontend and backend
- Alert on error rate spikes
- Track encryption-related failures separately (passphrase errors, decryption failures)

### 7. User data export

Users have no way to back up their tree. Combined with "passphrase lost = data lost", this is a real risk at scale.

- Encrypted JSON export (download encrypted blob that can be re-imported)
- Or plaintext export with explicit user confirmation ("this will create an unencrypted file")
- Foundation for future GEDCOM export

### 8. Async email sending

Registration endpoint blocks on SMTP connection. Under load, this causes request timeouts and poor user experience.

- Move email sending to background task (threading, or task queue)
- Verification, waitlist approval, and feedback notification emails
- Graceful degradation: registration succeeds even if email send fails

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

### 11. Wellbeing check-in

Small optional prompt when opening the app: "How are you feeling right now?" Stored privately, shown over time as a personal trend. Reinforces the app as a self-care tool. Also a gentle session timer nudge: "You've been working for 45 minutes. Would you like to take a break?"

## Planned: Infrastructure (lower priority)

### 12. Passphrase hints and auth modals

User-written passphrase recovery hints, auth modal overlay replacing the unlock page redirect, and auto-lock on inactivity.

- **Passphrase hints**: optional hint stored server-side, shown during unlock
- **Auth modal**: full-viewport overlay with hero background, two modes (unlock / re-auth)
- **Auto-lock**: configurable inactivity timer (default 15 min) clears encryption key

See [design doc](plans/2026-02-15-passphrase-hints-auth-modals-design.md).

### 13. Passkey authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside email+password. Phishing-resistant authentication using biometrics, device PIN, or security keys. Encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org / traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

### 14. Cloud Run scaling configuration

Current settings are conservative for beta. Adjust before wider rollout.

- Increase `MAX_ACTIVE_USERS` from 20 to 200+
- Increase Cloud Run max-instances from 4 to 8-16
- Set min-instances to 1 (eliminates 5-10s cold start latency)
- Increase DB connection pool: `pool_size=10, max_overflow=20`

### 15. Client-side virtualization

Large trees (500+ persons, 2000+ events) will cause rendering lag in timeline and event lists.

- Windowing library (react-window or similar) for timeline and long lists
- Viewport-aware rendering for React Flow canvas (already partially handled by @xyflow/react)
- Consider lazy-loading event details in PersonDetailPanel

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

### Safety envelope

Three-layer protection system: onboarding gate, safety footer, lock + blur screen. [Design doc](plans/2026-02-16-safety-envelope-design.md).

## Backlog

### Features
- OAuth/social login
- GEDCOM import/export
- PDF/image export (with filtering: choose which persons/events to include)
- Custom category management
- Collaborative/shared trees (view-only or edit permissions)
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
