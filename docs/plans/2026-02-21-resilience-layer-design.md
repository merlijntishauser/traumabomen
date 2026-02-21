# Resilience and Strengths Layer

## Problem

The app is strong on mapping trauma and deficits but has no way to capture positive events: who broke a cycle, where healing happened, what protective factors existed. Without this, the tool risks feeling like a pathology catalog. Practitioners like Mark Wolynn ("It Didn't Start with You") need both sides of the story.

## Design

A new **TurningPoint** entity type, following the exact pattern of TraumaEvent and LifeEvent: encrypted client-side, person-linked via junction table, visualized on canvas (star badges) and timeline (star markers).

### Categories

Five categories reflecting the roadmap's resilience themes:

- `cycle_breaking` — consciously ending a generational pattern
- `protective_relationship` — a relationship that provided safety or stability
- `recovery` — healing milestone, therapy breakthrough, sobriety
- `achievement` — education, career, personal growth despite adversity
- `positive_change` — relocation, new beginning, family reconciliation

### Encrypted Content

```typescript
interface TurningPoint {
  title: string;
  description: string;
  category: TurningPointCategory;
  approximate_date: string;
  significance: number | null;  // 1-10 scale
  tags: string[];
}
```

All fields encrypted client-side. Server stores opaque blobs.

## Backend

### Model

`TurningPoint` table (`id`, `tree_id`, `encrypted_data`, `created_at`, `updated_at`) + `TurningPointPerson` junction table. Added to the `Tree` model as a relationship. Same pattern as `LifeEvent` / `LifeEventPerson`.

### Router

`api/app/routers/turning_points.py` using `crud_helpers.EntityConfig`. Five endpoints under `/trees/{tree_id}/turning-points`: create, list, get, update, delete.

### Sync

Add `turning_points_create/update/delete` to `SyncRequest` and `SyncResponse`. Handle in `sync.py` via existing `_create_encrypted_entities`, `_update_entities_with_persons`, `_delete_by_tree` helpers.

### Migration

Alembic autogenerate for the two new tables.

## Frontend Data Layer

### Types

`TurningPointCategory` enum and `TurningPoint` interface in `domain.ts`. API types in `api.ts`.

### API Functions

`getTurningPoints`, `createTurningPoint`, `updateTurningPoint`, `deleteTurningPoint` in `api.ts`.

### Data Hook

`useTreeData` adds `turningPointsQuery` returning `Map<string, DecryptedTurningPoint>`. Query key: `treeQueryKeys.turningPoints(treeId)`.

### Mutations

`useTreeMutations` adds create/update/delete with optimistic update on update (same pattern as life events). Person deletion invalidates turning points query.

### Colors

New `turningPointColors.ts` with CSS variable lookup and fallback constants. Warm, hopeful palette (greens, golds, soft blues) contrasting with trauma reds/purples. CSS variables added to both theme variants in `theme.css`.

### Pattern Linking

`LinkedEntity.entity_type` union extended with `"turning_point"`.

## Canvas

### Badge

Star shape via CSS `clip-path`, colored by category. Renders after classification badges on PersonNode. Tooltip shows title, category, date, significance.

### PersonDetailPanel

New "Turning Points" section after Life Events, before Classifications. Accordion-style list with add/edit/delete. Fields: title, category (select), approximate date, description, significance (1-10 slider), tags, person linking.

## Timeline

Star-shaped SVG markers on person lanes, colored by category. Tooltips show title, category, date, significance, linked persons. Label stacking integrates with existing offset computation. Pattern dimming and filter groups include turning points.

## Demo Tree

Add example turning point entries to showcase the feature for new users.

## Translations

Full EN + NL keys for section title, add/edit/delete labels, all 5 category names, field labels.

## Files

### Backend (create)
- `api/app/models/turning_point.py`
- `api/app/routers/turning_points.py`
- `api/alembic/versions/xxx_add_turning_points.py`

### Backend (modify)
- `api/app/models/tree.py`
- `api/app/schemas/tree.py`
- `api/app/schemas/sync.py`
- `api/app/routers/sync.py`
- `api/app/main.py`

### Frontend (create)
- `frontend/src/lib/turningPointColors.ts`

### Frontend (modify)
- `frontend/src/types/domain.ts`
- `frontend/src/types/api.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useTreeData.ts`
- `frontend/src/hooks/useTreeMutations.ts`
- `frontend/src/components/tree/PersonNode.tsx` + CSS
- `frontend/src/components/tree/PersonDetailPanel.tsx`
- `frontend/src/lib/treeLayoutHelpers.ts`
- `frontend/src/components/timeline/` (markers, helpers, data maps)
- `frontend/src/lib/createDemoTree.ts`
- `frontend/src/styles/theme.css`
- `frontend/public/locales/en/translation.json`
- `frontend/public/locales/nl/translation.json`

### Tests
- Backend: pytest for turning points router + sync integration
- Frontend: vitest for colors, badge rendering, data hooks
