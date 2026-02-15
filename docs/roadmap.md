# Roadmap

## Planned

### Care Providers

Track mental health professionals and institutes as their own nodes on the canvas, connected to persons via dedicated care edges. Opt-in per tree via "Enable care providers functionality" setting.

- **CareProvider nodes**: name, kind (professional/institute), role, optional modality, notes
- **CareRelationship edges**: link one provider to multiple persons with per-person care periods
- **CareProviderDetailPanel**: edit provider details and manage linked persons with periods
- **Timeline**: care periods render as strips below person life bars
- Visually distinct from family nodes (pill shape, teal/green, dotted edges)

See [design doc](plans/2026-02-15-care-providers-design.md).

### Passphrase Hints and Auth Modals

User-written passphrase recovery hints, auth modal overlay replacing the unlock page redirect, and auto-lock on inactivity.

- **Passphrase hints**: optional hint stored server-side, shown during unlock
- **Auth modal**: full-viewport overlay with hero background, two modes (unlock / re-auth)
- **Auto-lock**: configurable inactivity timer (default 15 min) clears encryption key

See [design doc](plans/2026-02-15-passphrase-hints-auth-modals-design.md).

### Passkey Authentication

Passkeys (WebAuthn/FIDO2) as an alternative login method alongside email+password. Phishing-resistant authentication using biometrics, device PIN, or security keys. Encryption passphrase remains separate.

- **Login**: "Sign in with passkey" button using discoverable credentials
- **Multi-domain**: separate credentials per domain (traumatrees.org / traumabomen.nl)
- **Management**: add/remove passkeys in settings, multiple per account
- **Prompt**: one-time post-login banner encouraging passkey setup

See [design doc](plans/2026-02-15-passkey-auth-design.md).

### Pattern Editor

Annotation layer linking multiple TraumaEvents across generations to mark recurring themes (e.g., addiction patterns, attachment disruption). Each pattern has a name, description, and linked event IDs.

## Backlog / Unplanned

### new features
- OAuth/social login.... SSO? 
- GEDCOM import/export
- PDF/image export
- Custom category management
- Collaborative/shared trees
- Offline-first with service worker
- Additional languages beyond English and Dutch
- "familie opstelling" functionality, needs an I person node
- import of some "big" family trees software products?
- list of mental health organisations per country, which a user can reach out to for help

### needs to be fixed or checked 
- license check! (fonts/ images / used libraries)
- directly add an adopted sibling? 
- double check auto assignment of generations in timeline view
- entering years... sometimes buggy? or non optimal UX

### Improvments
- Search on classifications, should be on both main categories as subcatergories
- Extend subcategories on classifications
- Add DSM 5 codes to classifications
- Add a possible unknown birth year, but allow a before year, or decade

### To think about
- more themes
- optional pet support? some users might to be able to add their pet to the family tree
- more debug info/verbosity on email sending...
- we might need a more UX friendly waiting/working notification
- Beta testing alert/ feedback possibility
- swagger for fast api? only in dev
- rate-limiting on login?
- context menu on relations, persons and canvas? 
- life-event: started/stopped medication
- call name / nickname for persons
- possibility to send short questionnaires to persons, who can enter their answers in the tree without account
- Funny thing: add a mascotte which pops up after 10 minutes, asking if you're still there and ok

---

### Unfiltered notes
