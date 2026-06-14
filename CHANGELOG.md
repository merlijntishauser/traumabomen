# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Traumabomen / Traumatrees ships continuously: every deploy is tagged
> `v0.1.x`. Rather than list each deploy, entries below group the notable,
> user-facing changes by release period, with representative version tags noted
> for traceability. Internal-only changes (CI, linting, coverage ratchets,
> refactors, test additions) are omitted.

## [Unreleased]

### Changed

- Updated frontend dependencies (i18next, react-i18next, lucide-react,
  `@sentry/vite-plugin`, typescript-eslint).

## [0.1.148 – 0.1.160] - 2026-06

### Added

- **Pattern focus mode.** A canvas spotlight that dims the whole tree and
  lights one pattern's members in its colour, with an in-scene detail card
  (people, generations spanned, and linked entities). Replaces the metaball
  "blob" overlay. (v0.1.157)
- **Bulk-link a sibling group.** Dragging an edge to or from a sibling-group
  pill creates the chosen relationship for every in-tree sibling at once, for
  example linking all siblings to one step-parent. (v0.1.158)
- **Pattern spotlight in the live demo.** The public `/demo` now uses the same
  read-only spotlight, driven by a labeled "Patterns" dropdown in the header.
  (v0.1.159, v0.1.160)
- **Public `/learn` page** on intergenerational trauma, in English and Dutch.
  (v0.1.150)
- Real product screenshots on the landing page, replacing the SVG glimpses.
  (v0.1.149)
- Denser, varied procedural foliage on the landing margin tree. (v0.1.152)

### Changed

- **The light theme now reads indigo.** The brand mark and calls to action use
  indigo (`#4f46e5`) instead of green, which read generic-wellness on cream.
  (v0.1.154)
- One identical back-to-home control on every public page. (v0.1.151)
- Backend integration tests run against PostgreSQL in CI (matching production),
  with a shared test schema. (v0.1.155, v0.1.156)

### Fixed

- A sibling group whose members are all promoted to full nodes is now hidden;
  promotion inherits the shared parents so all siblings render consistently; and
  the spotlight count and panel agree. (v0.1.157, v0.1.158)
- The demo's cross-generational pattern listed two people but its linked events
  touched three; `person_ids` now matches the persons those entities touch.
  (v0.1.160)
- Production startup crash from a missing `jinja2` dependency. (v0.1.145)
- The end-to-end unlock selector no longer matches the visibility toggle.
  (v0.1.148)

## [0.1.139 – 0.1.147] - 2026-04 – 2026-06

### Added

- Adding a biological sibling now inherits the existing sibling's biological
  parents, so the new person is attached to the same parents. (v0.1.142)

### Changed

- Dependency and tooling updates; raised coverage on under-tested modules.
  (v0.1.139 – v0.1.144, v0.1.147)

## [0.1.100 – 0.1.138] - 2026-03

### Added

- **Reflection journal** with guided, open-question prompts, plus a
  **personal insights summary** page surfacing generational patterns, temporal
  clustering, category summaries, and resilience indicators (all computed
  client-side). (insights marked done v0.1.107)
- **Resilience layer.** A "Turning Point" event type for mapping
  cycle-breaking, recovery, and protective relationships, with star badges on
  the canvas and star markers on the timeline.
- **Sibling groups.** Compact pill nodes representing siblings without full
  Person nodes, promotable to full persons in a single bulk sync. (v0.1.129)
- **Watercolor theme**, promoted to the default light theme. (v0.1.114 –
  v0.1.121)
- March UX pass: password reset by email, password/passphrase visibility
  toggles, a labeled registration step indicator, a "choose a stronger
  password" hint, cleaner person-node year display, and an `N` shortcut to add
  a person.
- March UI polish across dark, light, and watercolor themes: glass-panel
  contrast, canvas depth, person-node structure, heading-weight variation, and
  smooth theme transitions.
- Admin badge and admins-first ordering in the user list; the running git tag
  and commit hash shown in the app footer. (v0.1.102, v0.1.103)
- Side-by-side welcome and login glass panels. (v0.1.104)

### Changed

- Replaced the technical word "entities" with "items" in UI labels. (v0.1.106)
- Background contour decoration hides when the canvas grid is enabled.
  (v0.1.110)

### Fixed

- Feedback form returning 401 for logged-out users (v0.1.133), logout
  redirecting to the lock screen instead of login (v0.1.119), name-input
  select-all being cleared by mouseup (v0.1.120), and a null-event crash in the
  Sentry `beforeSend` hook (v0.1.132).

### Security

- Patched a minimatch ReDoS vulnerability (CVE-2026-27903). (v0.1.100)
- Filtered Sentry error noise from bots and crawlers. (v0.1.130)

## [0.1.56 – 0.1.99] - 2026-02 (mid-to-late February)

### Added

- **Safety envelope.** A three-layer protection system: an onboarding
  acknowledgement gate, a persistent safety footer, and a lock + blur screen.
  (v0.1.58)
- **Pattern editor.** An annotation layer linking trauma events, life events,
  and classifications across generations to mark recurring themes, with
  on-canvas visualization and a dedicated pattern view. (v0.1.62)
- **Beta waitlist** with a configurable active-user cap and admin-approval
  invite emails. (v0.1.69)
- **In-app feedback form** (bug, feature, general) with anonymous option and
  admin review. (v0.1.72, v0.1.73)
- **Timeline redesign:** dual-axis (years and age) modes, smart person-group
  filtering, pattern visualization, partner relationship lines, and zoom/pan.
- **Passphrase hints and auth modals.** Optional passphrase recovery hint, a
  full-viewport auth modal (unlock and re-auth modes), and auto-lock on
  inactivity.
- **User data export.** Per-tree encryption keys with a master-key-encrypted
  key ring, plus encrypted and plaintext JSON export and re-import.
- Route-based code splitting and WebP hero images for faster initial loads.
  (v0.1.78, v0.1.84)
- An empty-canvas state for new trees. (v0.1.65)

### Changed

- Mobile login optimized with a hero-banner layout. (v0.1.56)

### Security

- **API rate limiting:** nginx limits plus application-layer progressive
  backoff on failed logins (tarpitting, lockout, auto-expiry).
- **Production error tracking** via Sentry with privacy safeguards (no PII, no
  ciphertext in request context, hashed user IDs).
- **Async email sending** with retries and graceful degradation, so requests no
  longer block on SMTP.
- February security-audit hardening: client- and server-side password-strength
  validation, single-use refresh-token rotation, constant-time passphrase-hash
  comparison, and DB SSL / email TLS enforcement in production.
- Hardened nginx security headers and added post-deploy ZAP and Nuclei scanning.
  (v0.1.48 – v0.1.50)
- Patched an ajv ReDoS vulnerability. (v0.1.89)

## [0.1.0 – 0.1.55] - 2026-02-13 – 2026-02-15

Initial public beta.

### Added

- **Zero-knowledge encrypted tree.** All sensitive data is encrypted
  client-side (AES-256-GCM with Argon2id key derivation); the server stores only
  opaque ciphertext and never sees plaintext.
- **Tree canvas** (React Flow + Dagre auto-layout): person CRUD, all
  relationship types, temporal partner relationships, and adoption.
- **Trauma events** and **life events** with categories, and **DSM-5
  classifications** (suspected/diagnosed, recurring periods, subcategories).
  (v0.1.40)
- **Friend relationship type** with its own layout and styling. (v0.1.24)
- **Timeline view** (D3): generational rows, life bars, and event markers;
  friend-only persons filtered out. (v0.1.32)
- **Multiple trees per user** (the one-tree MVP limit was removed). (v0.1.33)
- **Admin dashboard:** usage, retention, signup funnel, growth chart, activity
  heatmap, and user list. (v0.1.25 – v0.1.27)
- **Privacy policy** page in English and Dutch. (v0.1.28)
- English and Dutch throughout, with hostname-based language detection.
  (v0.1.0)
- **Production deployment pipeline:** Cloud Run, multi-stage distroless Docker
  images, a database migration job, and a post-deploy smoketest. (v0.1.0 –
  v0.1.21)
- Compact base62 IDs in tree URLs. (v0.1.16)

### Changed

- Set the canonical English domain to `www.traumatrees.org`. (v0.1.35)
- Improved touch usability on iPad. (v0.1.36)
