# Care Providers Feature

## Context

Users want to track mental health professionals and institutes associated with persons in their family tree. Care providers appear as their own nodes on the canvas, visually distinct from persons, connected via dedicated care edges. This serves two purposes: visualizing care timelines alongside trauma/life events, and showing which professionals are involved with which family members.

The feature is opt-in per tree via a setting: "Enable care providers functionality". When disabled (the default), all care provider UI is hidden. Data is preserved when toggled off.

## Data Model

Two new models -- **CareProvider** (node) and **CareRelationship** (edge):

### CareProvider (canvas node)

Stored as an encrypted blob, like Person:

```
CareProvider
  id: UUID
  name: string                   -- "Dr. van den Berg" or "GGZ Rivierduinen"
  kind: "professional" | "institute"
  role: string                   -- psychiatrist | psychologist | therapist |
                                    counselor | social_worker | gp | other
  modality: string (optional)    -- cbt | emdr | family_therapy | group_therapy |
                                    psychoanalysis | medication | other
  notes: string (optional)
  pinned_position: {x, y} | null -- user-dragged position (like Person)
```

### CareRelationship (edge connecting persons to provider)

Stored as an encrypted blob:

```
CareRelationship
  id: UUID
  person_ids: list[UUID]         -- persons receiving care
  care_provider_id: UUID         -- the care provider
  periods: list[{               -- per-person care periods
    person_id: UUID,
    start_year: int,
    end_year: int | null         -- null = ongoing
  }]
```

Key decisions:

- CareProvider is its own node, not an entity attached to persons.
- The link between persons and providers lives in CareRelationship (the edge).
- Care periods live on the edge, per person -- same provider can have different periods with different family members.
- One CareRelationship fans out from the provider to multiple persons.
- Separate from the existing Relationship model (which is person-to-person only).

## Per-Tree Feature Toggle

Stored in the tree's encrypted canvas settings:

```
TreeSettings (existing canvas settings object)
  showMarkers: boolean
  enableCareProviders: boolean   -- new, defaults to false
  ...
```

When `enableCareProviders` is **false** (default):
- CareProvider nodes hidden from canvas
- CareEdge edges hidden from canvas
- Care provider period strips hidden from timeline
- No care provider actions visible anywhere
- Data is preserved, just not rendered

When `enableCareProviders` is **true**:
- All care provider UI renders normally

Toggle location: SettingsPanel canvas section, labeled "Enable care providers functionality".

## Backend

Two new encrypted-blob endpoint groups following the existing pattern:

### CareProvider endpoints

`api/app/routers/care_providers.py`:

- `GET /trees/{id}/care-providers` -- list all for tree
- `POST /trees/{id}/care-providers` -- create
- `PUT /trees/{id}/care-providers/{provider_id}` -- update
- `DELETE /trees/{id}/care-providers/{provider_id}` -- delete

### CareRelationship endpoints

`api/app/routers/care_relationships.py`:

- `GET /trees/{id}/care-relationships` -- list all for tree
- `POST /trees/{id}/care-relationships` -- create
- `PUT /trees/{id}/care-relationships/{relationship_id}` -- update
- `DELETE /trees/{id}/care-relationships/{relationship_id}` -- delete

### Bulk sync

Add `care_providers` and `care_relationships` to the existing `/trees/{id}/sync` endpoint.

### Migration

Two new tables (`care_providers`, `care_relationships`) with indexes on `tree_id`.

## Frontend

### Types

New enums in `domain.ts`: `CareProviderKind`, `CareProviderRole`, `CareProviderModality`. New interfaces: `CareProvider`, `CareRelationship`, `CareRelationshipPeriod`.

### API and state

- `api.ts`: CRUD functions for both care providers and care relationships.
- `useTreeData.ts`: Add `useQuery` for care providers and care relationships alongside existing entity queries.
- `useTreeMutations.ts`: Add save/delete mutations for both models.

### CareProviderNode (new component)

Visually distinct from PersonNode:

- Smaller than person nodes, pill/rounded rectangle shape.
- Icon indicating kind (person silhouette for professional, building for institute).
- Shows name and role label.
- Distinct border color (teal/green), separate from warm tones used for family nodes.
- Draggable -- saves `pinned_position` like person nodes.
- Click opens CareProviderDetailPanel.

### CareEdge (new component)

Visually distinct from relationship edges:

- Dotted line in a unique color.
- Fans out from provider node to each linked person.
- No arrow/marker -- the connection is non-directional.
- Shows period summary on hover or as a small label.

### Layout positioning

Care provider nodes positioned near their linked persons:

- Compute average position of linked persons.
- Offset slightly (e.g. 150px to the right or below).
- Avoid overlap with existing nodes.
- Respect pinned positions when user has dragged them.

### CareProviderDetailPanel (new component)

Opens when clicking a care provider node:

- Header: name field (editable), kind toggle (professional/institute).
- Role: select dropdown.
- Modality: optional select.
- Notes: free text field.
- Linked persons: list with per-person care periods (start/end year). Add/remove persons via multi-person picker. Each person row has its own period editor.
- Delete: button with confirmation.

### Timeline view

Care provider periods render as horizontal strips (similar to classification period strips):

- Positioned below the person's life bar alongside classification strips.
- Labeled with provider name and role.
- Distinct color (teal/green) to differentiate from classification strips.
- One strip per care relationship period per person.
- Hidden when `enableCareProviders` is false.

### No PersonNode badges

Care providers are visible as their own nodes on the canvas, so no badges on person nodes. PersonNode stays unchanged.

### i18n

Translation keys under `careProvider.*` namespace in both `en/translation.json` and `nl/translation.json` for all roles, modalities, labels, and form text.

## Files

| File | Action | Description |
|------|--------|-------------|
| `api/app/models/care_provider.py` | Create | CareProvider SQLAlchemy model |
| `api/app/models/care_relationship.py` | Create | CareRelationship SQLAlchemy model |
| `api/app/routers/care_providers.py` | Create | CareProvider CRUD endpoints |
| `api/app/routers/care_relationships.py` | Create | CareRelationship CRUD endpoints |
| `api/app/routers/sync.py` | Edit | Add both to bulk sync |
| `api/alembic/versions/...` | Create | Migration for both tables |
| `frontend/src/types/domain.ts` | Edit | CareProvider types, enums, CareRelationship |
| `frontend/src/lib/api.ts` | Edit | CRUD API functions for both models |
| `frontend/src/hooks/useTreeData.ts` | Edit | Add useQuery for both models |
| `frontend/src/hooks/useTreeMutations.ts` | Edit | Add save/delete mutations for both |
| `frontend/src/hooks/useTreeLayout.ts` | Edit | Add CareProviderNode + CareEdge to layout |
| `frontend/src/lib/treeLayoutHelpers.ts` | Edit | Care provider positioning logic |
| `frontend/src/components/tree/CareProviderNode.tsx` | Create | Care provider canvas node |
| `frontend/src/components/tree/CareProviderNode.css` | Create | Care provider node styles |
| `frontend/src/components/tree/CareEdge.tsx` | Create | Care edge component |
| `frontend/src/components/tree/CareProviderDetailPanel.tsx` | Create | Care provider detail panel |
| `frontend/src/components/tree/TreeWorkspacePage.tsx` | Edit | Register new node/edge types, toggle |
| `frontend/src/components/tree/SettingsPanel.tsx` | Edit | Add feature toggle |
| `frontend/src/components/tree/TimelineView.tsx` | Edit | Care period strips |
| `frontend/src/lib/timelineHelpers.ts` | Edit | Care provider period processing |
| `frontend/src/locales/en/translation.json` | Edit | English translations |
| `frontend/src/locales/nl/translation.json` | Edit | Dutch translations |
