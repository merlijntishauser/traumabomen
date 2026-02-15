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
