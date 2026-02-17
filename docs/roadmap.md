# Roadmap

## Assessment

The app is strong on mapping and visualization (tree canvas, timeline, DSM classifications) but thin on the reflection and sense-making side. There is great data entry, but limited tools to help users actually process what they have entered. The current feature set is deficit-focused (trauma events, classifications, severity scores) without an explicit resilience or strengths layer.

Priority should shift toward features that turn the tree from a diagram into a living reflection tool. Resilience tracking and a reflection journal are the highest-impact additions for the core "personal reflection" use case. Infrastructure features (passkeys, auth modals) are valuable polish but secondary to the reflection mission.

## Planned -- Beta readiness (immediate)

### 1. Beta waitlist and user cap

Configurable user cap (default 20) with email-only waitlist. When the cap is reached, new visitors join a waitlist by submitting their email. Admin approves from the dashboard, triggering an invitation email with a registration link. Controlled by `ENABLE_WAITLIST` and `MAX_ACTIVE_USERS` environment variables.

See [design doc](plans/2026-02-17-beta-waitlist-design.md).

## Planned -- Reflection (high priority)

### 2. Resilience and strengths layer

Balance the deficit focus with a way to map resilience: who broke a cycle, what protective factors existed, where did healing happen.

- New event type: "Turning point" or "Resilience event"
- Own color on canvas badges and timeline markers
- Categories: cycle-breaking, protective relationship, recovery, achievement, positive change
- Keeps the tool from feeling purely pathology-oriented

### 3. Reflection journal

Per-tree journal with timestamped entries. Not a generic diary -- entries that can optionally link to specific persons, events, patterns, or classifications.

- Chronological list in a slide-out panel or dedicated view
- Optional entity linking ("Today I realized my grandmother's displacement mirrors my own feeling of never belonging")
- Rich text or markdown for longer entries
- The connective tissue between the data and the meaning

### 4. Guided reflection prompts

Small curated library of optional prompts that help users explore their tree more deeply. Available as starting points for journal entries.

- "Who in your family tree do you most identify with, and why?"
- "What event had the most ripple effects across generations?"
- "Are there strengths or resilience patterns, not just trauma?"
- "What patterns do you notice repeating?"
- Static, curated -- not AI-generated

### 5. Personal insights summary

Read-only overview page per tree that surfaces basic observations from what the user already entered.

- "3 generations affected by addiction"
- "Loss events cluster around ages 30-40"
- "2 persons share the same classification"
- Not AI analysis -- counting and grouping, presented as a reflection starting point

## Planned -- Features (medium priority)

### 6. Timeline view refinement

The timeline view needs significant work to become a useful reflection tool rather than just a data display.

- Layout and spacing improvements for readability
- Better visual hierarchy between generations
- Pattern overlays on the timeline (connecting related events visually)
- Interaction improvements (click-to-select, hover detail, zoom/pan)
- Responsive behavior for different tree sizes
- Visual connection between timeline markers and the canvas view

### 7. Care providers

Track mental health professionals and institutes as their own nodes on the canvas, connected to persons via dedicated care edges. Opt-in per tree via "Enable care providers functionality" setting.

- **CareProvider nodes**: name, kind (professional/institute), role, optional modality, notes
- **CareRelationship edges**: link one provider to multiple persons with per-person care periods
- **CareProviderDetailPanel**: edit provider details and manage linked persons with periods
- **Timeline**: care periods render as strips below person life bars
- Visually distinct from family nodes (pill shape, teal/green, dotted edges)

See [design doc](plans/2026-02-15-care-providers-design.md).

### 8. Canvas annotations

Free-text sticky notes or arrows that users can place directly on the canvas between nodes. Sometimes the insight is spatial. Lighter than the pattern editor.

### 9. Wellbeing check-in

Small optional prompt when opening the app: "How are you feeling right now?" Stored privately, shown over time as a personal trend. Reinforces the app as a self-care tool. Also a gentle session timer nudge: "You've been working for 45 minutes. Would you like to take a break?"

## Planned -- Infrastructure (lower priority)

### 10. Passphrase hints and auth modals

User-written passphrase recovery hints, auth modal overlay replacing the unlock page redirect, and auto-lock on inactivity.

- **Passphrase hints**: optional hint stored server-side, shown during unlock
- **Auth modal**: full-viewport overlay with hero background, two modes (unlock / re-auth)
- **Auto-lock**: configurable inactivity timer (default 15 min) clears encryption key

See [design doc](plans/2026-02-15-passphrase-hints-auth-modals-design.md).

### 11. Passkey authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside email+password. Phishing-resistant authentication using biometrics, device PIN, or security keys. Encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org / traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

## Done

### In-app feedback form

Structured feedback (bug, feature, general) via modal in the footer. Stored in database, shown in admin dashboard with category badges, email notification to configurable address. Anonymous submission option. [Design doc](plans/2026-02-17-feedback-form-design.md).

### Pattern editor

Annotation layer linking trauma events, life events, and classifications across generations to mark recurring themes. Metaball contour visualization on the canvas, theme-aware colors, hover preview from panel, dedicated pattern view with edit-on-canvas navigation. [Design doc](plans/2026-02-16-pattern-editor-design.md).

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
- canvas tools, zooming in/out, panning
- filtering show/hide entity types

### Improvements
- Unknown birth year with approximation (before year, or decade)
- Call name / nickname for persons
- Directly add an adopted sibling shortcut

### To think about
- More themes
- Optional pet support
- Better loading/working notifications
- Swagger for FastAPI (dev only)
- Rate-limiting on login (tarpitting scheme)
- More debug info on email sending
