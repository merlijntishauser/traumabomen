# Roadmap

## Current state (June 2026)

The core product is complete and polished: encrypted tree canvas, timeline,
DSM-5 classifications, pattern editor with a single-pattern canvas spotlight,
life and trauma events, turning points (resilience), reflection journal with
guided prompts, personal insights, and sibling groups. The safety envelope
(onboarding gate, footer, lock screen) and zero-knowledge encryption are solid.

Since March the work has been polish and reach rather than new core features:
the pattern spotlight replaced the metaball blobs, sibling groups gained
parent-inheriting promotion and bulk-linking, and a public marketing surface
shipped (landing with real screenshots, `/learn`, `/tour`, `/security`, a
read-only `/demo` tree, indigo light theme). Quality and security
infrastructure remain strong (97% / 98% coverage with ratcheting, CodeQL,
Nuclei, ZAP, privacy scanner, Lighthouse, react-doctor 100). Backend
integration tests now run against PostgreSQL in CI.

The product is feature-rich but still gated to a private beta
(`MAX_ACTIVE_USERS = 100`, waitlist). The operational readiness work is done:
scaling was raised and every deploy now runs a Playwright smoketest against
production (login, unlock, encrypted tree round-trip, cleanup). **The defining
question for the next phase is no longer "what feature is missing from the
canvas" but "what is required to let real people in and keep their data
safe."** That reframes the priorities below.

## Priorities

A tiered view of everything that remains, including gaps not previously on the
roadmap (see [Gaps and risks](#gaps-and-risks)). Reasoning, not just ordering.

### Now: readiness to widen the beta (cheap, high-leverage)

1. **Mobile experience (gap).** The public pages and demo now work on phones;
   inside the app a banner still tells phone users to switch to desktop. For a
   private, reflective tool people reach for in quiet moments, "desktop only"
   is the single largest adoption barrier. A usable read/pan/inspect experience
   for one's own tree is worth more than any new canvas feature.
2. **Passphrase-loss mitigation (gap).** "Lose your passphrase, lose everything"
   is honest and by design, but with no safety net it is also the scariest part
   of onboarding and a silent churn driver. A downloadable recovery code that
   wraps the key ring a second way keeps zero-knowledge intact while removing
   the cliff. Design carefully; high value.

### Next: depth that matches the product's purpose

4. **Read-only tree sharing (#11).** The highest-value remaining *feature*.
   Intergenerational work is inherently shared; letting a user show a view to a
   sibling, parent, or therapist is core to what the product is for. Complex
   (per-recipient key exchange) but the design and the export prerequisite are
   done.
5. **In-app onboarding (gap).** New users currently land on a blank canvas after
   the safety modal. A short guided first-run (or a "start from the demo" path)
   converts curiosity into a real tree.
6. **Care providers (#12)** and **canvas annotations (#9).** Self-contained
   depth features with design docs. Annotations are cheap; care providers lean
   into the therapy-adjacent angle.

### Later: when scale or evidence demands it

7. **elkjs + collapsible sub-trees (#18)** and **client-side virtualization
   (#17).** Both only matter once trees are large (500+ persons). Beta trees are
   small; defer until real large trees exist, then do #18 first.
8. **Passkey authentication (#15).** Phishing-resistant login is a nice upgrade,
   but email + password is sufficient for beta.
9. **Wellbeing check-in (#13).** On-brand and small, but the least urgent.

## Remaining work

### Features

#### 9. Canvas annotations

Free-positioned sticky notes on the canvas for spatial observations. Six muted
colors for visual grouping. Double-click canvas or toolbar button to create,
inline editing with color picker. Encrypted text, plaintext position. New
Annotation entity with CRUD endpoints and bulk sync support.
See [design doc](plans/2026-03-02-canvas-annotations-design.md).

*Assessment:* low risk, self-contained, modest value. Good "filler" work
between larger efforts.

#### 11. Read-only tree sharing

Share a tree with another user for viewing. Builds on the per-tree key
architecture from the export milestone.

- RSA-OAEP 4096-bit key pair generated per user on first unlock, private key
  encrypted with master key
- Sharer encrypts tree key with recipient's public key; stored in `TreeShare`
  model
- Pending shares for non-registered recipients: invite email sent,
  auto-completed when recipient creates account
- Recipient decrypts shared tree keys on unlock; shared trees appear in a
  separate "Shared with me" section
- Server-side read-only enforcement (viewer can GET but not POST/PUT/DELETE);
  journal entries excluded
- Display name field for user identity in shares
- Revoke access by deleting the share grant

See [design doc](plans/2026-03-01-read-only-tree-sharing-design.md).
Prerequisite: user data export (done).

*Assessment:* highest-value feature, highest feature complexity. The
cryptographic key exchange must be reviewed carefully. Pairs naturally with
PDF/print export for offline sharing.

#### 12. Care providers

Track mental health professionals and institutes as their own nodes on the
canvas, connected to persons via dedicated care edges. Opt-in per tree via an
"Enable care providers functionality" setting.

- **CareProvider nodes**: name, kind (professional/institute), role, optional
  modality, notes
- **CareRelationship edges**: link one provider to multiple persons with
  per-person care periods
- **CareProviderDetailPanel**: edit provider details and manage linked persons
  with periods
- **Timeline**: care periods render as strips below person life bars
- Visually distinct from family nodes (pill shape, teal/green, dotted edges)

See [design doc](plans/2026-02-15-care-providers-design.md).

*Assessment:* medium value, medium effort; reinforces the therapy-adjacent
positioning. Opt-in keeps it out of the way for users who do not want it.

#### 13. Wellbeing check-in

Small optional prompt when opening the app: "How are you feeling right now?"
Stored privately, shown over time as a personal trend. Reinforces the app as a
self-care tool. Also a gentle session-timer nudge: "You've been working for 45
minutes. Would you like to take a break?"

*Assessment:* small and on-brand; low urgency. The break nudge is worth
shipping even before the mood trend.

### Platform and infrastructure

#### 15. Passkey authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside
email + password. Phishing-resistant authentication using biometrics, device
PIN, or security keys. The encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org /
  traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

#### 17. Client-side virtualization

Large trees (500+ persons, 2000+ events) will cause rendering lag in the
timeline and event lists.

- Windowing library (react-window or similar) for the timeline and long lists
- Viewport-aware rendering for the React Flow canvas (already partially handled
  by @xyflow/react)
- Consider lazy-loading event details in PersonDetailPanel

#### 18. Replace Dagre with elkjs and collapsible sub-trees

Replace the Dagre layout engine with elkjs (the open-source engine behind React
Flow Pro's auto-layout) and add collapsible ancestor/descendant sub-trees with
compact summary nodes. Drop the React Flow Pro watermark suppression.
See [design doc](plans/2026-02-26-elkjs-collapse-design.md).

## Gaps and risks

Items not previously on the roadmap, surfaced by reviewing the current state.
Several outrank the formally-planned features above.

### Mobile and responsive (high)

The public pages (landing, learn, tour, security, demo, auth) work on phones
as of v0.1.161 – v0.1.167. The app itself still shows a "use a desktop" banner
on small screens. For a personal, private tool, that excludes the context in
which many people would actually use it. Remaining scope: read, pan, and
inspect on mobile for one's own tree; full editing can stay desktop-first.

### Passphrase recovery (high)

There is no recovery path if the passphrase is lost, by design, but also no
mitigation. A user-initiated, downloadable recovery code (a second wrapping of
the key ring) would preserve zero-knowledge while removing the single scariest
failure mode. Treat as a security-design task, not a quick fix.

### In-app onboarding (medium)

Beyond the safety acknowledgement modal there is no first-run guidance. New
users face an empty canvas. A short guided tour, sample-data nudge, or "explore
the demo first" path would lift activation.

### Tree history, soft-delete, and backup (medium)

Undo is session-only. There is no protection against accidental tree or person
deletion and no server-side version history. For irreplaceable personal data,
soft-delete (recoverable for N days) and/or periodic encrypted snapshots are
worth considering. Manual export helps but is not a safety net.

### In-tree search (medium)

No way to find a person quickly in a larger tree. A simple name search /
jump-to-node would scale with tree size and pairs well with #17/#18.

### PDF / print export (medium)

Listed in the backlog, but its value is higher than "someday": therapists and
family members often want an offline artifact, and it pairs directly with
read-only sharing (#11). Needs person/event filtering to avoid oversharing.

### Canvas accessibility (low-medium)

react-doctor scores 100, but a React Flow canvas is inherently hard for screen
readers. A list or timeline alternative view for assistive technology would
close the gap. Audit before any public, non-beta launch.

### Process: usability and security cadence (ongoing)

No evidence yet of testing with real users outside the team, and the February
security audit is now four months old. Schedule a small usability round before
widening the beta and a periodic security re-review.

## Backlog

### Features
- OAuth/social login
- GEDCOM import/export
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
- Global events not tied to a person but visible in the timeline (COVID-19, WWII, etc.)
