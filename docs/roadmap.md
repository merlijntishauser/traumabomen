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

## Backlog

### new features
- OAuth/social login.... SSO? 
- GEDCOM import/export
- PDF/image export
- Custom category management
- Collaborative/shared trees
- Offline-first with service worker
- Additional languages beyond English and Dutch

### needs to be fixed or checked 
- license check! (fonts/ images / used libraries)
- directly add an adopted sibling? 

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

---

### Unfiltered notes
  future
  > import major gen software trees...
  multi-user... allow to share a tree, with view rights only, or edit rights
  pdf export..en bij export, mogelijkheid om personen/trauma's/gebeurtenissen "eruit te filteren"
  module systemisch werken... ortho weergave. poppetjes kunnen schuiven
  
  hulporganisaties... voor niet nl, misschien link naar aantal hulporganisaties in in europa/amerika? 
  pagina met overzicht openemen, net als de privacy pagina
  
  geboortedatum onbekend mogelijk maken *maar wel tussen , of voor... schatting.
  
  jaartallen kiezen niet altijd logisch
  
  systeem/familie opstellingen functionaliteit
   -> IK nodig... verder "poppen" uit stamboom, met trauma markering beschikbaar om in ortho view te plaatsen

   optie bijnamen/roepnamen te geven
   
   dubbelchecken van generaties... (waar kees en tiny indezelfde generatie als ik en Ingrid)
   
   privacy statement: 2 tabs: for non techies/ techies

   vragenlijst voor familieleden... kiezen welke vragen.. ze vullen het zonder account in, informatie
   
   zoeken op classificties in zowel cat als sub cat
   dsm codes? 

   geinigheidje.. na 5 minuten een "mascotte" die om de hoek komt kijken en vraagt of je nog ok bent...