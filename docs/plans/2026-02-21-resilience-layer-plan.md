# Resilience Layer (Turning Points) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Turning Point" event type for mapping resilience, strengths, and cycle-breaking alongside existing trauma/life events.

**Architecture:** New entity following the exact LifeEvent pattern: encrypted blob + person junction table on the backend, React Query + optimistic mutations on the frontend, star-shaped badges on the canvas, star markers on the timeline. Five categories: cycle-breaking, protective relationship, recovery, achievement, positive change.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query + React Flow + D3 (frontend), Alembic (migration), Vitest + pytest (tests)

**Design doc:** `docs/plans/2026-02-21-resilience-layer-design.md`

---

## Task 1: Backend Model and Migration

**Files:**
- Create: `api/app/models/turning_point.py`
- Modify: `api/app/models/tree.py:35-37` (add relationship, follow life_events pattern)

**Step 1: Create the model**

Create `api/app/models/turning_point.py` following `api/app/models/life_event.py` exactly:

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TurningPointPerson(Base):
    __tablename__ = "turning_point_persons"

    turning_point_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("turning_points.id", ondelete="CASCADE"), primary_key=True
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("persons.id", ondelete="CASCADE"), primary_key=True
    )


class TurningPoint(Base):
    __tablename__ = "turning_points"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trees.id", ondelete="CASCADE"), index=True
    )
    encrypted_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tree: Mapped["Tree"] = relationship(back_populates="turning_points")
    person_links: Mapped[list[TurningPointPerson]] = relationship(
        cascade="all, delete-orphan",
    )
```

**Step 2: Add relationship to Tree model**

In `api/app/models/tree.py`, add after the existing `life_events` relationship (around line 37):

```python
    turning_points: Mapped[list["TurningPoint"]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )
```

Add import at top of tree.py:
```python
from app.models.turning_point import TurningPoint
```

**Step 3: Generate migration**

Run: `docker compose exec api uv run alembic revision --autogenerate -m "add turning points"`

**Step 4: Run migration**

Run: `docker compose exec api uv run alembic upgrade head`

**Step 5: Commit**

```
Backend model and migration for turning points
```

---

## Task 2: Backend Schemas and Router

**Files:**
- Modify: `api/app/schemas/tree.py` (add schemas after LifeEventResponse, around line 117)
- Create: `api/app/routers/turning_points.py`
- Modify: `api/app/main.py` (register router)

**Step 1: Add schemas**

In `api/app/schemas/tree.py`, add after `LifeEventResponse`:

```python
# --- TurningPoint ---


class TurningPointCreate(_LinkedEntityCreate):
    pass


class TurningPointUpdate(_LinkedEntityUpdate):
    pass


class TurningPointResponse(_LinkedEntityResponse):
    pass
```

**Step 2: Create the router**

Create `api/app/routers/turning_points.py` following `api/app/routers/life_events.py`:

```python
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.turning_point import TurningPoint, TurningPointPerson
from app.models.tree import Tree
from app.routers.crud_helpers import (
    EntityConfig,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
)
from app.schemas.tree import TurningPointCreate, TurningPointResponse, TurningPointUpdate

router = APIRouter(prefix="/trees/{tree_id}/turning-points", tags=["turning-points"])

_config = EntityConfig(
    model=TurningPoint,
    junction_model=TurningPointPerson,
    junction_fk="turning_point_id",
    response_schema=TurningPointResponse,
    not_found_detail="Turning point not found",
)


@router.post("", response_model=TurningPointResponse, status_code=status.HTTP_201_CREATED)
async def create_turning_point(
    body: TurningPointCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> TurningPointResponse:
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)  # type: ignore[return-value]


@router.get("", response_model=list[TurningPointResponse])
async def list_turning_points(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[TurningPointResponse]:
    return await list_entities(_config, tree.id, db)  # type: ignore[return-value]


@router.get("/{turning_point_id}", response_model=TurningPointResponse)
async def get_turning_point(
    turning_point_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> TurningPointResponse:
    return await get_entity(_config, turning_point_id, tree.id, db)  # type: ignore[return-value]


@router.put("/{turning_point_id}", response_model=TurningPointResponse)
async def update_turning_point(
    turning_point_id: uuid.UUID,
    body: TurningPointUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> TurningPointResponse:
    return await update_entity(
        _config, turning_point_id, tree.id, body.encrypted_data, body.person_ids, db
    )  # type: ignore[return-value]


@router.delete("/{turning_point_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_turning_point(
    turning_point_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, turning_point_id, tree.id, db)
```

**Step 3: Register router in main.py**

Add import and include following the life_events pattern in `api/app/main.py`.

**Step 4: Write backend tests**

Create `api/tests/test_turning_points.py` following the pattern in `api/tests/test_life_events.py`. Test all five CRUD endpoints: create, list, get, update, delete. Test ownership isolation (user B cannot access user A's turning points). Test 404 for nonexistent turning point.

**Step 5: Run tests**

Run: `docker compose exec api uv run pytest tests/test_turning_points.py -v`
Run: `docker compose exec api uv run pytest` (full suite)
Run: `docker compose exec api uv run mypy app/`

**Step 6: Commit**

```
Add turning points CRUD router and backend tests
```

---

## Task 3: Sync Integration

**Files:**
- Modify: `api/app/schemas/sync.py` (add sync schemas + request/response fields)
- Modify: `api/app/routers/sync.py` (add turning point handling in all phases)

**Step 1: Add sync schemas**

In `api/app/schemas/sync.py`, add after the pattern sync classes:

```python
class SyncTurningPointCreate(TurningPointCreate):
    id: uuid.UUID | None = None


class SyncTurningPointUpdate(TurningPointUpdate):
    id: uuid.UUID
```

Add to `SyncRequest`:
```python
    turning_points_create: list[SyncTurningPointCreate] = []
    turning_points_update: list[SyncTurningPointUpdate] = []
    turning_points_delete: list[SyncDelete] = []
```

Add to `SyncResponse`:
```python
    turning_points_created: list[uuid.UUID] = []
    turning_points_updated: int = 0
    turning_points_deleted: int = 0
```

**Step 2: Add sync handling**

In `api/app/routers/sync.py`, add `TurningPoint` and `TurningPointPerson` imports. Then add turning point handling in each phase:

- `_phase_deletes`: add `_delete_by_tree(TurningPoint, ...)`
- `_collect_referenced_person_ids`: add loop for `body.turning_points_create`
- `_add_junction_rows`: add loop creating `TurningPointPerson` rows
- `_phase_creates`: add `_create_encrypted_entities(TurningPoint, ...)`
- `_phase_updates`: add `_update_entities_with_persons(...)` call

Follow the exact pattern used for classifications and patterns.

**Step 3: Add sync tests**

Add turning point sync tests to `api/tests/test_sync.py` following the pattern of classification/pattern sync tests. Test create, update, delete via sync, and person_id validation.

**Step 4: Run tests**

Run: `docker compose exec api uv run pytest tests/test_sync.py -v`
Run: `docker compose exec api uv run pytest`
Run: `docker compose exec api uv run mypy app/`
Run: `docker compose exec api uv run bandit -r app/`

**Step 5: Commit**

```
Add turning points to bulk sync endpoint
```

---

## Task 4: Frontend Types, API, and Colors

**Files:**
- Modify: `frontend/src/types/domain.ts` (add enum + interface after LifeEvent)
- Modify: `frontend/src/types/api.ts` (add API types after LifeEvent types)
- Modify: `frontend/src/lib/api.ts` (add API functions after life event functions)
- Create: `frontend/src/lib/turningPointColors.ts`
- Create: `frontend/src/lib/turningPointColors.test.ts`
- Modify: `frontend/src/styles/theme.css` (add CSS variables in both themes)

**Step 1: Add domain types**

In `frontend/src/types/domain.ts`, add after `LifeEvent`:

```typescript
export enum TurningPointCategory {
  CycleBreaking = "cycle_breaking",
  ProtectiveRelationship = "protective_relationship",
  Recovery = "recovery",
  Achievement = "achievement",
  PositiveChange = "positive_change",
}

export interface TurningPoint {
  title: string;
  description: string;
  category: TurningPointCategory;
  approximate_date: string;
  significance: number | null;
  tags: string[];
}
```

**Step 2: Add API types**

In `frontend/src/types/api.ts`, add after life event types:

```typescript
// Turning Points
export interface TurningPointCreate {
  person_ids: string[];
  encrypted_data: string;
}

export interface TurningPointUpdate {
  person_ids?: string[];
  encrypted_data?: string;
}

export interface TurningPointResponse {
  id: string;
  person_ids: string[];
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Add API functions**

In `frontend/src/lib/api.ts`, add after life event functions, following the same pattern:

```typescript
// Turning Points

export function getTurningPoints(treeId: string): Promise<TurningPointResponse[]> {
  return apiFetchWithRetry(`/trees/${treeId}/turning-points`);
}

export function createTurningPoint(
  treeId: string,
  data: TurningPointCreate,
): Promise<TurningPointResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/turning-points`, {
    method: "POST",
    body: data,
  });
}

export function updateTurningPoint(
  treeId: string,
  turningPointId: string,
  data: TurningPointUpdate,
): Promise<TurningPointResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/turning-points/${turningPointId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteTurningPoint(treeId: string, turningPointId: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${treeId}/turning-points/${turningPointId}`, {
    method: "DELETE",
  });
}
```

**Step 4: Add CSS variables**

In `frontend/src/styles/theme.css`, add in the dark theme section (after life event colors, around line 67):

```css
  /* Turning point categories */
  --color-tp-cycle-breaking: #34d399;
  --color-tp-protective-relationship: #60a5fa;
  --color-tp-recovery: #a78bfa;
  --color-tp-achievement: #fbbf24;
  --color-tp-positive-change: #2dd4bf;
```

And in the light theme section (after life event colors, around line 164):

```css
  --color-tp-cycle-breaking: #059669;
  --color-tp-protective-relationship: #2563eb;
  --color-tp-recovery: #7c3aed;
  --color-tp-achievement: #d97706;
  --color-tp-positive-change: #0d9488;
```

**Step 5: Create color helper**

Create `frontend/src/lib/turningPointColors.ts` following `frontend/src/lib/lifeEventColors.ts`:

```typescript
import { TurningPointCategory } from "../types/domain";

const TURNING_POINT_CSS_VARS: Record<TurningPointCategory, string> = {
  [TurningPointCategory.CycleBreaking]: "--color-tp-cycle-breaking",
  [TurningPointCategory.ProtectiveRelationship]: "--color-tp-protective-relationship",
  [TurningPointCategory.Recovery]: "--color-tp-recovery",
  [TurningPointCategory.Achievement]: "--color-tp-achievement",
  [TurningPointCategory.PositiveChange]: "--color-tp-positive-change",
};

export function getTurningPointColor(category: TurningPointCategory): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(TURNING_POINT_CSS_VARS[category])
    .trim();
  return value || TURNING_POINT_COLORS[category];
}

export function getTurningPointColors(): Record<TurningPointCategory, string> {
  const style = getComputedStyle(document.documentElement);
  const result = {} as Record<TurningPointCategory, string>;
  for (const [cat, varName] of Object.entries(TURNING_POINT_CSS_VARS)) {
    const value = style.getPropertyValue(varName).trim();
    result[cat as TurningPointCategory] = value || TURNING_POINT_COLORS[cat as TurningPointCategory];
  }
  return result;
}

export const TURNING_POINT_COLORS: Record<TurningPointCategory, string> = {
  [TurningPointCategory.CycleBreaking]: "#34d399",
  [TurningPointCategory.ProtectiveRelationship]: "#60a5fa",
  [TurningPointCategory.Recovery]: "#a78bfa",
  [TurningPointCategory.Achievement]: "#fbbf24",
  [TurningPointCategory.PositiveChange]: "#2dd4bf",
};
```

**Step 6: Write color tests**

Create `frontend/src/lib/turningPointColors.test.ts` following `frontend/src/lib/lifeEventColors.test.ts`. Test that `getTurningPointColor` returns a string for each category and that `TURNING_POINT_COLORS` has all 5 categories.

**Step 7: Run tests**

Run: `docker compose exec frontend npx vitest run src/lib/turningPointColors.test.ts`
Run: `docker compose exec frontend npx tsc --noEmit`

**Step 8: Commit**

```
Add frontend types, API functions, and color system for turning points
```

---

## Task 5: Data Hooks (useTreeData + useTreeMutations)

**Files:**
- Modify: `frontend/src/hooks/useTreeData.ts` (add query, type, key, empty map)
- Modify: `frontend/src/hooks/useTreeMutations.ts` (add 3 mutations)

**Step 1: Add to useTreeData**

Follow the life events pattern exactly:
- Add `DecryptedTurningPoint` interface (extends `TurningPoint` with `id` and `person_ids`)
- Add `turningPoints` query key to `treeQueryKeys`
- Add `EMPTY_TURNING_POINTS` empty map
- Add `turningPointsQuery` using `useQuery` with decrypt
- Return `turningPoints` from the hook

**Step 2: Add to useTreeMutations**

Follow the life events pattern exactly:
- `createTurningPointMutation`: encrypt and create, invalidate on success
- `updateTurningPointMutation`: encrypt and update, optimistic update with rollback
- `deleteTurningPointMutation`: delete, invalidate on success
- Add turning points invalidation to the person delete mutation's `onSuccess`
- Return all three mutations

**Step 3: Run type check**

Run: `docker compose exec frontend npx tsc --noEmit`

**Step 4: Commit**

```
Add turning point data fetching and mutation hooks
```

---

## Task 6: Canvas Badges (PersonNode)

**Files:**
- Modify: `frontend/src/lib/treeLayoutHelpers.ts:403-441` (add to `buildEntityLookups` and `EntityLookups`)
- Modify: `frontend/src/components/tree/PersonNode.tsx` (add star badges)
- Modify: `frontend/src/components/tree/PersonNode.css` (add star clip-path)
- Modify: `frontend/src/hooks/useTreeLayout.ts` (pass turningPoints to layout)
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx` (pass turningPoints to layout hook)

**Step 1: Extend EntityLookups**

In `treeLayoutHelpers.ts`, add `turningPointsByPerson` to the `EntityLookups` interface and the `buildEntityLookups` function, following the lifeEvents pattern.

Update `buildEntityLookups` signature to accept optional `turningPoints` parameter.

**Step 2: Pass through the layout chain**

In `useTreeLayout.ts`, pass `turningPoints` parameter through to `buildEntityLookups`.
In `TreeWorkspacePage.tsx`, pass `turningPoints` to `useTreeLayout`.

**Step 3: Add star badge CSS**

In `PersonNode.css`, add after the classification badge:

```css
.person-node__badge--turning-point {
  border-radius: 0;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}

.person-node__badge--turning-point.person-node__badge--with-initial {
  width: 14px;
  height: 14px;
  font-size: 6px;
}

.person-node__tooltip-dot--turning-point {
  border-radius: 0;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
}
```

**Step 4: Add badge rendering**

In `PersonNode.tsx`, add turning point badge rendering after classification badges, following the life event badge pattern. Use `getTurningPointColor(tp.category)` for colors. Badge type: `data-badge-type="turning_point"`. Tooltip shows title, category, date, significance.

**Step 5: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`

**Step 6: Commit**

```
Add star-shaped turning point badges to canvas person nodes
```

---

## Task 7: PersonDetailPanel Section

**Files:**
- Modify: `frontend/src/components/tree/PersonDetailPanel.tsx` (add turning points section)

**Step 1: Add turning points section**

Add a new section for turning points in the PersonDetailPanel, placed after Life Events and before Classifications. Follow the exact pattern of the life events section:
- Section header with star icon and count
- Accordion list of existing turning points with edit/delete
- Add form with fields: title, category (select with 5 options), approximate date, description, significance (1-10 range input), tags, person linking
- Wire up to `mutations.createTurningPoint`, `mutations.updateTurningPoint`, `mutations.deleteTurningPoint`

**Step 2: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`

**Step 3: Commit**

```
Add turning points CRUD section to PersonDetailPanel
```

---

## Task 8: Translations

**Files:**
- Modify: `frontend/public/locales/en/translation.json`
- Modify: `frontend/public/locales/nl/translation.json`

**Step 1: Add English translations**

```json
  "turningPoint.title": "Turning Points",
  "turningPoint.add": "Add turning point",
  "turningPoint.edit": "Edit turning point",
  "turningPoint.delete": "Delete turning point",
  "turningPoint.titleField": "Title",
  "turningPoint.description": "Description",
  "turningPoint.category": "Category",
  "turningPoint.approximate_date": "Approximate date",
  "turningPoint.significance": "Significance",
  "turningPoint.tags": "Tags",
  "turningPoint.category.cycle_breaking": "Cycle-breaking",
  "turningPoint.category.protective_relationship": "Protective relationship",
  "turningPoint.category.recovery": "Recovery",
  "turningPoint.category.achievement": "Achievement",
  "turningPoint.category.positive_change": "Positive change"
```

**Step 2: Add Dutch translations**

```json
  "turningPoint.title": "Keerpunten",
  "turningPoint.add": "Keerpunt toevoegen",
  "turningPoint.edit": "Keerpunt bewerken",
  "turningPoint.delete": "Keerpunt verwijderen",
  "turningPoint.titleField": "Titel",
  "turningPoint.description": "Beschrijving",
  "turningPoint.category": "Categorie",
  "turningPoint.approximate_date": "Geschatte datum",
  "turningPoint.significance": "Significantie",
  "turningPoint.tags": "Labels",
  "turningPoint.category.cycle_breaking": "Doorbreken van patronen",
  "turningPoint.category.protective_relationship": "Beschermende relatie",
  "turningPoint.category.recovery": "Herstel",
  "turningPoint.category.achievement": "Prestatie",
  "turningPoint.category.positive_change": "Positieve verandering"
```

**Step 3: Commit**

```
Add EN and NL translations for turning points
```

---

## Task 9: Timeline Integration

**Files:**
- Modify: `frontend/src/components/timeline/timelineHelpers.ts` (add to data maps and time domain)
- Modify: `frontend/src/components/timeline/TimelineView.tsx` (pass turning points through)
- Modify: `frontend/src/components/timeline/TimelineYearsContent.tsx` (pass to lanes)
- Modify: `frontend/src/components/timeline/TimelineAgeContent.tsx` (pass to lanes)
- Modify: `frontend/src/components/timeline/PersonLane.tsx` (render star markers)
- Modify: `frontend/src/pages/TimelinePage.tsx` (pass turning points from data hook)

**Step 1: Add to timeline helpers**

In `timelineHelpers.ts`, add `turningPointsByPerson` to `PersonDataMaps` interface and `buildPersonDataMaps` function. Add turning point dates to `computeTimeDomain` so the time axis expands to include them.

**Step 2: Thread turning points through components**

Pass turning points from `TimelinePage` through `TimelineView`, `TimelineYearsContent`/`TimelineAgeContent`, and into `PersonLane`. Follow the exact pattern used for life events at each level.

**Step 3: Render star markers in PersonLane**

Add turning point marker rendering after life event markers. Use a star SVG path (5-point star polygon). Color by category using `turningPointColors`. Tooltips show title, category, date, significance, linked persons. Include in label stacking computation.

**Step 4: Add to filter groups**

Include turning points in the timeline filter group definitions so they can be dimmed/hidden by pattern filtering.

**Step 5: Run tests**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`

**Step 6: Commit**

```
Add turning point markers to timeline view
```

---

## Task 10: Pattern Linking and Demo Tree

**Files:**
- Modify: `frontend/src/types/domain.ts` (extend LinkedEntity union)
- Modify: `frontend/src/lib/createDemoTree.ts` (add demo turning points)
- Modify: pattern-related components to handle `"turning_point"` entity type

**Step 1: Extend LinkedEntity**

In `domain.ts`, add `"turning_point"` to the `entity_type` union in the `LinkedEntity` interface.

**Step 2: Update pattern components**

Ensure pattern panel, pattern connectors, and pattern view handle `"turning_point"` entities: color lookup, icon rendering, entity title resolution.

**Step 3: Add demo turning points**

In `createDemoTree.ts`, add 1-2 turning point entries on demo persons to showcase the feature.

**Step 4: Run full verification**

Run: `docker compose exec frontend npx vitest run`
Run: `docker compose exec frontend npx tsc --noEmit`
Run: `docker compose exec api uv run pytest`
Run: `docker compose exec api uv run mypy app/`
Run: `docker compose exec api uv run bandit -r app/`
Run: `make quality`

**Step 5: Commit**

```
Add turning points to pattern linking and demo tree
```
