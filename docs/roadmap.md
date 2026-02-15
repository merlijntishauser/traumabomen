# Roadmap

## Planned

### Care Providers

Track mental health professionals and institutes associated with persons in the family tree. A new CareProvider entity (like events and classifications) with:

- **Kind**: professional or institute
- **Role**: psychiatrist, psychologist, therapist, counselor, social worker, GP, other
- **Modality** (optional): CBT, EMDR, family therapy, group therapy, psychoanalysis, medication, other
- **Care periods**: per-person start/end years for timeline visualization
- **Multi-person linking**: same provider shared across family members

Renders as diamond badges on person nodes and as period strips on the timeline view.

See [design doc](plans/2026-02-15-care-providers-design.md).

### Pattern Editor

Annotation layer linking multiple TraumaEvents across generations to mark recurring themes (e.g., addiction patterns, attachment disruption). Each pattern has a name, description, and linked event IDs.

## Backlog

- OAuth/social login
- GEDCOM import/export
- PDF/image export
- Custom category management
- Collaborative/shared trees
- Passphrase recovery hints
- Offline-first with service worker
- Additional languages beyond English and Dutch
