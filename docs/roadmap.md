# Roadmap

## Assessment

The app is strong on mapping and visualization (tree canvas, timeline, DSM classifications) but thin on the reflection and sense-making side. There is great data entry, but limited tools to help users actually process what they have entered. The current feature set is deficit-focused (trauma events, classifications, severity scores) without an explicit resilience or strengths layer.

Priority should shift toward features that turn the tree from a diagram into a living reflection tool. The pattern editor, resilience tracking, and a reflection journal are the highest-impact additions for the core "personal reflection" use case. Infrastructure features (passkeys, auth modals) are valuable polish but secondary to the reflection mission.

## Planned -- Reflection (high priority)

### 1. Safety Envelope

Three-layer protection system wrapping the user experience: emotional context-setting, persistent safety reminders, and instant privacy controls. Should be in place before adding deeper reflection features.

- **Onboarding gate**: fullscreen post-registration step explaining what the tool is (and isn't), what it may bring up, and how encryption works
- **Safety footer**: merged footer with "personal reflection tool -- not therapy" disclaimer, crisis support link, and lock icon
- **Lock + blur**: instant panic hide (double-Esc or footer icon), key stays in memory, passphrase verifies to unlock
- **Two-tier auto-lock**: blur at 5 min inactivity, full key clearing at 30 min

See [design doc](plans/2026-02-16-safety-envelope-design.md).

### 2. Pattern Editor

Annotation layer linking multiple TraumaEvents across generations to mark recurring themes (e.g., addiction patterns, attachment disruption). The moment the tree stops being a diagram and becomes an insight.

- Each pattern has a name, description, and linked event IDs
- Visual overlay on the canvas connecting related events across generations
- Pattern summary visible in timeline view

### 3. Resilience and Strengths Layer

Balance the deficit focus with a way to map resilience: who broke a cycle, what protective factors existed, where did healing happen.

- New event type: "Turning point" or "Resilience event"
- Own color on canvas badges and timeline markers
- Categories: cycle-breaking, protective relationship, recovery, achievement, positive change
- Keeps the tool from feeling purely pathology-oriented

### 4. Reflection Journal

Per-tree journal with timestamped entries. Not a generic diary -- entries that can optionally link to specific persons, events, patterns, or classifications.

- Chronological list in a slide-out panel or dedicated view
- Optional entity linking ("Today I realized my grandmother's displacement mirrors my own feeling of never belonging")
- Rich text or markdown for longer entries
- The connective tissue between the data and the meaning

### 5. Guided Reflection Prompts

Small curated library of optional prompts that help users explore their tree more deeply. Available as starting points for journal entries.

- "Who in your family tree do you most identify with, and why?"
- "What event had the most ripple effects across generations?"
- "Are there strengths or resilience patterns, not just trauma?"
- "What patterns do you notice repeating?"
- Static, curated -- not AI-generated

### 6. Personal Insights Summary

Read-only overview page per tree that surfaces basic observations from what the user already entered.

- "3 generations affected by addiction"
- "Loss events cluster around ages 30-40"
- "2 persons share the same classification"
- Not AI analysis -- counting and grouping, presented as a reflection starting point

## Planned -- Features (medium priority)

### 7. Care Providers

Track mental health professionals and institutes as their own nodes on the canvas, connected to persons via dedicated care edges. Opt-in per tree via "Enable care providers functionality" setting.

- **CareProvider nodes**: name, kind (professional/institute), role, optional modality, notes
- **CareRelationship edges**: link one provider to multiple persons with per-person care periods
- **CareProviderDetailPanel**: edit provider details and manage linked persons with periods
- **Timeline**: care periods render as strips below person life bars
- Visually distinct from family nodes (pill shape, teal/green, dotted edges)

See [design doc](plans/2026-02-15-care-providers-design.md).

### 8. Canvas Annotations

Free-text sticky notes or arrows that users can place directly on the canvas between nodes. Sometimes the insight is spatial. Lighter than the pattern editor.

### 9. Wellbeing Check-in

Small optional prompt when opening the app: "How are you feeling right now?" Stored privately, shown over time as a personal trend. Reinforces the app as a self-care tool. Also a gentle session timer nudge: "You've been working for 45 minutes. Would you like to take a break?"

## Planned -- Infrastructure (lower priority)

### 10. Passphrase Hints and Auth Modals

User-written passphrase recovery hints, auth modal overlay replacing the unlock page redirect, and auto-lock on inactivity.

- **Passphrase hints**: optional hint stored server-side, shown during unlock
- **Auth modal**: full-viewport overlay with hero background, two modes (unlock / re-auth)
- **Auto-lock**: configurable inactivity timer (default 15 min) clears encryption key

See [design doc](plans/2026-02-15-passphrase-hints-auth-modals-design.md).

### 11. Passkey Authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside email+password. Phishing-resistant authentication using biometrics, device PIN, or security keys. Encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org / traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

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
- List of mental health organisations per country
- Questionnaires for family members (no account needed, answers feed into the tree)

### Improvements
- Search on classifications: both main categories and subcategories
- Extend subcategories on classifications
- Add DSM-5 codes to classifications
- Unknown birth year with approximation (before year, or decade)
- Call name / nickname for persons
- Life event: started/stopped medication
- Context menu on relations, persons, and canvas
- Directly add an adopted sibling shortcut

### To think about
- More themes
- Optional pet support
- Better loading/working notifications
- Beta testing alert and feedback mechanism
- Swagger for FastAPI (dev only)
- Rate-limiting on login
- More debug info on email sending
