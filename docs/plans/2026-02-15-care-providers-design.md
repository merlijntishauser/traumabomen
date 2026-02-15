# Care Providers Feature

## Context

Users want to track mental health professionals and institutes associated with persons in their family tree. This serves two purposes: visualizing care timelines alongside trauma/life events, and optionally connecting professionals to diagnoses/classifications.

## Data Model

A new **CareProvider** entity at the tree level, following the existing encrypted-blob pattern:

```
CareProvider
  id: UUID
  person_ids: list[UUID]         -- linked persons (multi-person, like events)
  name: string                   -- "Dr. van den Berg" or "GGZ Rivierduinen"
  kind: "professional" | "institute"
  role: string                   -- psychiatrist | psychologist | therapist |
                                    counselor | social_worker | gp | other
  modality: string (optional)    -- cbt | emdr | family_therapy | group_therapy |
                                    psychoanalysis | medication | other
  periods: list[{               -- care periods, per person
    person_id: UUID,
    start_year: int,
    end_year: int | null         -- null = ongoing
  }]
  notes: string (optional)
```

Key decisions:

- `kind` distinguishes individual professionals from institutes (changes icon/label in UI).
- `role` is the primary subcategory (required).
- `modality` is an optional treatment approach.
- `periods` are per-person: the same professional can see different family members at different times.
- A single CareProvider can be shared across multiple persons in the tree (same pattern as events and classifications).

## Backend

Follows the same pattern as events, life-events, and classifications.

### New model

`api/app/models/care_provider.py` -- SQLAlchemy model with `id`, `tree_id`, `encrypted_data`, `metadata` (person_ids for structural queries). Foreign key to trees with CASCADE delete.

### New routes

`api/app/routers/care_providers.py`:

- `GET /trees/{id}/care-providers` -- list all for tree
- `POST /trees/{id}/care-providers` -- create
- `PUT /trees/{id}/care-providers/{provider_id}` -- update
- `DELETE /trees/{id}/care-providers/{provider_id}` -- delete

### Bulk sync

Add `care_providers` to the existing `/trees/{id}/sync` endpoint.

### Migration

New `care_providers` table with index on `tree_id`.

## Frontend

### Types

New enums in `domain.ts`: `CareProviderKind`, `CareProviderRole`, `CareProviderModality`. New interfaces: `CarePeriod`, `CareProvider`.

### API and state

- `api.ts`: CRUD functions (`fetchCareProviders`, `createCareProvider`, `updateCareProvider`, `deleteCareProvider`).
- `useTreeData.ts`: Add `useQuery` for care providers alongside existing entity queries.
- `useTreeMutations.ts`: Add `saveCareProvider` and `deleteCareProvider` mutations.

### PersonDetailPanel

New collapsible "Care Providers" section showing providers linked to the selected person:

- Provider name, kind icon (person vs building), role badge, modality tag.
- Care periods for this specific person (start/end year).
- Add/edit/delete actions.
- `CareProviderForm` sub-component: name, kind toggle, role select, optional modality select, period editor, notes, multi-person linking.

### PersonNode

New diamond-shaped badge for care providers (alongside circles for trauma, squares for life events, triangles for classifications). Colored by kind: one color for professionals, another for institutes.

### Timeline view

Care provider periods render as horizontal bars (similar to classification period strips), positioned below the person's life bar. Labeled with provider name and role.

### i18n

Translation keys under `careProvider.*` namespace in both `en/translation.json` and `nl/translation.json` for all roles, modalities, labels, and form text.

## Files

| File | Action | Description |
|------|--------|-------------|
| `api/app/models/care_provider.py` | Create | SQLAlchemy model |
| `api/app/routers/care_providers.py` | Create | CRUD endpoints |
| `api/app/routers/sync.py` | Edit | Add care_providers to bulk sync |
| `api/alembic/versions/...` | Create | Migration for care_providers table |
| `frontend/src/types/domain.ts` | Edit | CareProvider types and enums |
| `frontend/src/lib/api.ts` | Edit | CRUD API functions |
| `frontend/src/hooks/useTreeData.ts` | Edit | Add useQuery for care providers |
| `frontend/src/hooks/useTreeMutations.ts` | Edit | Add save/delete mutations |
| `frontend/src/hooks/useTreeLayout.ts` | Edit | Pass care providers to node data |
| `frontend/src/lib/treeLayoutHelpers.ts` | Edit | Include care providers in entity lookups |
| `frontend/src/components/tree/PersonNode.tsx` | Edit | Diamond badges |
| `frontend/src/components/tree/PersonNode.css` | Edit | Diamond badge styles |
| `frontend/src/components/tree/PersonDetailPanel.tsx` | Edit | Care Providers section + form |
| `frontend/src/components/tree/TimelineView.tsx` | Edit | Care period strips |
| `frontend/src/lib/timelineHelpers.ts` | Edit | Care provider period data processing |
| `frontend/src/locales/en/translation.json` | Edit | English translations |
| `frontend/src/locales/nl/translation.json` | Edit | Dutch translations |
