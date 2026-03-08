# Sibling Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a SiblingGroup entity so users can compactly represent that a person has siblings without creating full Person nodes for each one.

**Architecture:** New linked entity (like TurningPoint/LifeEvent) with person_ids junction table. Backend uses the existing `create_linked_entity_router` factory for CRUD and extends the sync pipeline. Frontend adds a new React Flow node type (`siblingGroup`), a detail panel for editing members, and integration into the RelationshipsTab. A uniqueness constraint (one group per person) is enforced server-side.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + React Flow + TanStack Query (frontend), Vitest (tests), pytest (backend tests)

---

### Task 1: Backend model and migration

**Files:**
- Create: `api/app/models/sibling_group.py`
- Modify: `api/app/models/__init__.py`
- Modify: `api/app/models/tree.py`
- Create: new Alembic migration

**Step 1: Create the model file**

Create `api/app/models/sibling_group.py`:

```python
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, make_junction_model

SiblingGroupPerson = make_junction_model(
    "SiblingGroupPerson", "sibling_group_persons", "sibling_group_id", "sibling_groups"
)


class SiblingGroup(Base):
    __tablename__ = "sibling_groups"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trees.id", ondelete="CASCADE"), index=True
    )
    encrypted_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tree: Mapped[Tree] = relationship(back_populates="sibling_groups")
    person_links: Mapped[list[SiblingGroupPerson]] = relationship(
        cascade="all, delete-orphan",
    )
```

**Step 2: Add to `api/app/models/__init__.py`**

Add import alongside other models:
```python
from app.models.sibling_group import SiblingGroup, SiblingGroupPerson
```

Add both to the `__all__` list.

**Step 3: Add relationship to Tree model**

In `api/app/models/tree.py`, add after `journal_entries`:
```python
sibling_groups: Mapped[list[SiblingGroup]] = relationship(
    back_populates="tree", cascade="all, delete-orphan"
)
```

And add the forward reference import at top (same pattern as other entities: the `Tree` class uses string forward refs resolved by SQLAlchemy).

**Step 4: Generate Alembic migration**

Run:
```bash
docker compose exec api uv run alembic revision --autogenerate -m "add sibling groups"
```

Verify the generated migration creates:
- `sibling_groups` table (id, tree_id, encrypted_data, created_at, updated_at)
- `sibling_group_persons` junction table (sibling_group_id, person_id)
- Index on `sibling_groups.tree_id`

**Step 5: Run migration**

```bash
docker compose exec api uv run alembic upgrade head
```

**Step 6: Verify**

```bash
docker compose exec api uv run pytest -x -q
```

All existing tests should still pass.

**Step 7: Commit**

```bash
git add api/app/models/sibling_group.py api/app/models/__init__.py api/app/models/tree.py api/alembic/versions/
git commit -m "feat: add SiblingGroup model and migration"
```

---

### Task 2: Backend schemas

**Files:**
- Modify: `api/app/schemas/tree.py`

**Step 1: Add SiblingGroup schemas**

In `api/app/schemas/tree.py`, add after the Pattern schemas (following the same pattern as TurningPoint, LifeEvent, etc.):

```python
class SiblingGroupCreate(_LinkedEntityCreate):
    pass


class SiblingGroupUpdate(_LinkedEntityUpdate):
    pass


class SiblingGroupResponse(_LinkedEntityResponse):
    pass
```

**Step 2: Verify**

```bash
docker compose exec api uv run pytest -x -q
```

**Step 3: Commit**

```bash
git add api/app/schemas/tree.py
git commit -m "feat: add SiblingGroup request/response schemas"
```

---

### Task 3: Backend CRUD router with uniqueness constraint

**Files:**
- Create: `api/app/routers/sibling_groups.py`
- Modify: `api/app/main.py`
- Modify: `api/app/routers/crud_helpers.py`

**Step 1: Add uniqueness validation to crud_helpers**

The design requires: "A person can belong to at most one SiblingGroup per tree." The existing `create_linked_entity_router` doesn't support this, so we need to add a `pre_create_hook` and `pre_update_hook` parameter to `EntityConfig`, or implement this in a custom router.

The simplest approach: create the router using the factory but add a custom `pre_validate` parameter to `EntityConfig`. However, to keep changes minimal, create a custom router file that uses the shared CRUD helpers directly (like `create_entity`, `list_entities`, etc.) but adds the uniqueness check before create and update.

Create `api/app/routers/sibling_groups.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.sibling_group import SiblingGroup, SiblingGroupPerson
from app.models.tree import Tree
from app.routers.crud_helpers import (
    EntityConfig,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
    validate_persons_in_tree,
)
from app.schemas.tree import (
    SiblingGroupCreate,
    SiblingGroupResponse,
    SiblingGroupUpdate,
    _LinkedEntityCreate,
    _LinkedEntityUpdate,
)

_config = EntityConfig(
    model=SiblingGroup,
    junction_model=SiblingGroupPerson,
    junction_fk="sibling_group_id",
    response_schema=SiblingGroupResponse,
    not_found_detail="Sibling group not found",
)

router = APIRouter(prefix="/trees/{tree_id}/sibling-groups", tags=["sibling-groups"])


async def _check_person_uniqueness(
    person_ids: list[uuid.UUID],
    tree_id: uuid.UUID,
    db: AsyncSession,
    exclude_group_id: uuid.UUID | None = None,
) -> None:
    """Raise 409 if any person already belongs to another sibling group in this tree."""
    if not person_ids:
        return
    query = (
        select(SiblingGroupPerson.person_id)
        .join(SiblingGroup, SiblingGroup.id == SiblingGroupPerson.sibling_group_id)
        .where(
            SiblingGroup.tree_id == tree_id,
            SiblingGroupPerson.person_id.in_(person_ids),
        )
    )
    if exclude_group_id is not None:
        query = query.where(SiblingGroup.id != exclude_group_id)
    result = await db.execute(query)
    conflicts = {row[0] for row in result.all()}
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Person(s) already in a sibling group: {[str(c) for c in conflicts]}",
        )


@router.post("", response_model=SiblingGroupResponse, status_code=status.HTTP_201_CREATED)
async def create(
    body: _LinkedEntityCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SiblingGroupResponse:
    await _check_person_uniqueness(body.person_ids, tree.id, db)
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)


@router.get("", response_model=list[SiblingGroupResponse])
async def list_all(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[SiblingGroupResponse]:
    return await list_entities(_config, tree.id, db)


@router.get("/{entity_id}", response_model=SiblingGroupResponse)
async def get_one(
    entity_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SiblingGroupResponse:
    return await get_entity(_config, entity_id, tree.id, db)


@router.put("/{entity_id}", response_model=SiblingGroupResponse)
async def update(
    entity_id: uuid.UUID,
    body: _LinkedEntityUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SiblingGroupResponse:
    if body.person_ids is not None:
        await _check_person_uniqueness(body.person_ids, tree.id, db, exclude_group_id=entity_id)
    return await update_entity(
        _config, entity_id, tree.id, body.encrypted_data, body.person_ids, db
    )


@router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    entity_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, entity_id, tree.id, db)
```

**Step 2: Register router in main.py**

In `api/app/main.py`, add import and include:
```python
from app.routers.sibling_groups import router as sibling_groups_router
# ...
app.include_router(sibling_groups_router)
```

Place it near the other entity routers (after `turning_points_router`).

**Step 3: Verify**

```bash
docker compose exec api uv run pytest -x -q
```

**Step 4: Commit**

```bash
git add api/app/routers/sibling_groups.py api/app/main.py
git commit -m "feat: add sibling groups CRUD router with uniqueness constraint"
```

---

### Task 4: Backend CRUD tests

**Files:**
- Create: `api/tests/test_sibling_groups.py`

**Step 1: Write tests**

Create `api/tests/test_sibling_groups.py` following the exact pattern from `test_turning_points.py`:

```python
import uuid

import pytest

from tests.conftest import auth_headers, create_user

URL = "/trees/{tree_id}/sibling-groups"


@pytest.mark.asyncio
class TestCreateSiblingGroup:
    async def test_create(self, client, headers, tree, person):
        resp = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "enc"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "enc"
        assert data["person_ids"] == [person["id"]]

    async def test_create_invalid_person(self, client, headers, tree):
        resp = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [str(uuid.uuid4())], "encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_create_duplicate_person_conflict(self, client, headers, tree, person):
        """Person already in a group -> 409."""
        await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "g1"},
            headers=headers,
        )
        resp = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "g2"},
            headers=headers,
        )
        assert resp.status_code == 409


@pytest.mark.asyncio
class TestListSiblingGroups:
    async def test_list(self, client, headers, tree, person):
        await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "enc"},
            headers=headers,
        )
        resp = await client.get(URL.format(tree_id=tree["id"]), headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


@pytest.mark.asyncio
class TestGetSiblingGroup:
    async def test_get(self, client, headers, tree, person):
        create = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "enc"},
            headers=headers,
        )
        gid = create.json()["id"]
        resp = await client.get(f"{URL.format(tree_id=tree['id'])}/{gid}", headers=headers)
        assert resp.status_code == 200

    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(
            f"{URL.format(tree_id=tree['id'])}/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestUpdateSiblingGroup:
    async def test_update_encrypted_data(self, client, headers, tree, person):
        create = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "old"},
            headers=headers,
        )
        gid = create.json()["id"]
        resp = await client.put(
            f"{URL.format(tree_id=tree['id'])}/{gid}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    async def test_update_person_ids(self, client, headers, tree, person):
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]
        create = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "enc"},
            headers=headers,
        )
        gid = create.json()["id"]
        resp = await client.put(
            f"{URL.format(tree_id=tree['id'])}/{gid}",
            json={"person_ids": [person["id"], p2_id]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert set(resp.json()["person_ids"]) == {person["id"], p2_id}

    async def test_update_person_ids_conflict(self, client, headers, tree, person):
        """Moving a person who is already in another group -> 409."""
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]
        # Group 1 has person
        await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "g1"},
            headers=headers,
        )
        # Group 2 has p2
        g2 = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [p2_id], "encrypted_data": "g2"},
            headers=headers,
        )
        g2_id = g2.json()["id"]
        # Try to add person (already in g1) to g2
        resp = await client.put(
            f"{URL.format(tree_id=tree['id'])}/{g2_id}",
            json={"person_ids": [p2_id, person["id"]]},
            headers=headers,
        )
        assert resp.status_code == 409

    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"{URL.format(tree_id=tree['id'])}/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestDeleteSiblingGroup:
    async def test_delete(self, client, headers, tree, person):
        create = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "enc"},
            headers=headers,
        )
        gid = create.json()["id"]
        resp = await client.delete(
            f"{URL.format(tree_id=tree['id'])}/{gid}", headers=headers
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(
            f"{URL.format(tree_id=tree['id'])}/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestOwnershipIsolation:
    async def test_other_user_cannot_access(self, client, headers, tree, person, db_session):
        create = await client.post(
            URL.format(tree_id=tree["id"]),
            json={"person_ids": [person["id"]], "encrypted_data": "secret"},
            headers=headers,
        )
        gid = create.json()["id"]
        other = await create_user(db_session, email="other@example.com")
        other_headers = auth_headers(other.id)
        resp = await client.get(
            f"{URL.format(tree_id=tree['id'])}/{gid}", headers=other_headers
        )
        assert resp.status_code == 404
```

**Step 2: Run tests**

```bash
docker compose exec api uv run pytest tests/test_sibling_groups.py -v
```

**Step 3: Run full backend suite**

```bash
docker compose exec api uv run pytest -x -q
```

**Step 4: Commit**

```bash
git add api/tests/test_sibling_groups.py
git commit -m "test: add sibling group CRUD and uniqueness tests"
```

---

### Task 5: Backend bulk sync support

**Files:**
- Modify: `api/app/schemas/sync.py`
- Modify: `api/app/routers/sync.py`

**Step 1: Add sync schemas**

In `api/app/schemas/sync.py`, add the import:
```python
from app.schemas.tree import SiblingGroupCreate, SiblingGroupUpdate
```

Add the sync wrapper classes (after SyncJournalEntryUpdate):
```python
class SyncSiblingGroupCreate(SiblingGroupCreate):
    id: uuid.UUID | None = None


class SyncSiblingGroupUpdate(SiblingGroupUpdate):
    id: uuid.UUID
```

Add to `SyncRequest` (after `journal_entries_delete`):
```python
sibling_groups_create: list[SyncSiblingGroupCreate] = Field(default=[], max_length=500)
sibling_groups_update: list[SyncSiblingGroupUpdate] = Field(default=[], max_length=500)
sibling_groups_delete: list[SyncDelete] = Field(default=[], max_length=500)
```

Add to `SyncResponse`:
```python
sibling_groups_created: list[uuid.UUID] = []
sibling_groups_updated: int = 0
sibling_groups_deleted: int = 0
```

**Step 2: Add to sync router**

In `api/app/routers/sync.py`:

1. Import the model:
   ```python
   from app.models.sibling_group import SiblingGroup, SiblingGroupPerson
   ```

2. Add to `_JUNCTION_ENTITY_SPECS` tuple:
   ```python
   _EntitySpec(
       model=SiblingGroup,
       prefix="sibling_groups",
       label="sibling group",
       junction=_JunctionSpec(junction_model=SiblingGroupPerson, junction_fk="sibling_group_id"),
   ),
   ```

3. Add `SiblingGroup` to the `_DELETE_ORDER` tuple (alongside other junction entities, before Person).

Note: The sync router's generic pipeline already handles any entity in `_JUNCTION_ENTITY_SPECS` for create/update/delete. The uniqueness constraint is NOT enforced in sync (by design: sync is used for promotion which atomically updates the group's person_ids, so the constraint is maintained by the client).

**Step 3: Run sync tests**

```bash
docker compose exec api uv run pytest tests/test_sync.py -v
```

**Step 4: Add sync-specific tests**

Add to `api/tests/test_sync.py` (or create a new section):

```python
@pytest.mark.asyncio
class TestSyncSiblingGroups:
    async def test_create_sibling_group_via_sync(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "sibling_groups_create": [
                    {"person_ids": [person["id"]], "encrypted_data": "enc"}
                ]
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()["sibling_groups_created"]) == 1

    async def test_update_sibling_group_via_sync(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "sibling_groups_create": [
                    {"person_ids": [person["id"]], "encrypted_data": "old"}
                ]
            },
            headers=headers,
        )
        gid = create.json()["sibling_groups_created"][0]
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "sibling_groups_update": [
                    {"id": gid, "encrypted_data": "new"}
                ]
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["sibling_groups_updated"] == 1

    async def test_delete_sibling_group_via_sync(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "sibling_groups_create": [
                    {"person_ids": [person["id"]], "encrypted_data": "enc"}
                ]
            },
            headers=headers,
        )
        gid = create.json()["sibling_groups_created"][0]
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"sibling_groups_delete": [{"id": gid}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["sibling_groups_deleted"] == 1
```

**Step 5: Run all backend tests**

```bash
docker compose exec api uv run pytest -x -q
```

**Step 6: Commit**

```bash
git add api/app/schemas/sync.py api/app/routers/sync.py api/tests/test_sync.py
git commit -m "feat: add sibling groups to bulk sync pipeline"
```

---

### Task 6: Frontend domain types and API client

**Files:**
- Modify: `frontend/src/types/domain.ts`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add domain types**

In `frontend/src/types/domain.ts`, add:

```typescript
export interface SiblingGroupMember {
  name: string;
  birth_year: number | null;
}

export interface SiblingGroupData {
  members: SiblingGroupMember[];
}
```

**Step 2: Add API types**

In `frontend/src/types/api.ts`, add the linked entity type aliases (following PatternCreate/Update/Response pattern):

```typescript
export type SiblingGroupCreate = LinkedEntityCreate;
export type SiblingGroupUpdate = LinkedEntityUpdate;
export type SiblingGroupResponse = LinkedEntityResponse;
```

Add to `SyncRequest`:
```typescript
sibling_groups_create?: SyncLinkedCreate[];
sibling_groups_update?: SyncLinkedUpdate[];
sibling_groups_delete?: SyncDelete[];
```

Add to `SyncResponse`:
```typescript
sibling_groups_created: string[];
sibling_groups_updated: number;
sibling_groups_deleted: number;
```

**Step 3: Add API functions**

In `frontend/src/lib/api.ts`, add the CRUD API using the factory (after `patternsApi`):

```typescript
const siblingGroupsApi = makeCrudApi<SiblingGroupResponse, SiblingGroupCreate, SiblingGroupUpdate>(
  "sibling-groups",
);

export const getSiblingGroups = siblingGroupsApi.getAll;
export const getSiblingGroup = siblingGroupsApi.getOne;
export const createSiblingGroup = siblingGroupsApi.create;
export const updateSiblingGroup = siblingGroupsApi.update;
export const deleteSiblingGroup = siblingGroupsApi.remove;
```

Import the types at the top of the file.

**Step 4: Verify types compile**

```bash
docker compose exec frontend npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add frontend/src/types/domain.ts frontend/src/types/api.ts frontend/src/lib/api.ts
git commit -m "feat: add sibling group types and API client"
```

---

### Task 7: Frontend data layer (useTreeData, useTreeMutations)

**Files:**
- Modify: `frontend/src/hooks/useTreeData.ts`
- Modify: `frontend/src/hooks/useTreeMutations.ts`

**Step 1: Add to useTreeData**

In `frontend/src/hooks/useTreeData.ts`:

1. Add the `DecryptedSiblingGroup` type:
   ```typescript
   export interface DecryptedSiblingGroup extends SiblingGroupData {
     id: string;
     person_ids: string[];
   }
   ```

2. Add query key:
   ```typescript
   siblingGroups: (treeId: string) => ["trees", treeId, "siblingGroups"],
   ```

3. Add query using `useLinkedEntityQuery` (following the turningPoints pattern):
   ```typescript
   const siblingGroupsQuery = useLinkedEntityQuery<SiblingGroupData, DecryptedSiblingGroup>(
     treeQueryKeys.siblingGroups(treeId),
     getSiblingGroups,
     treeId,
     decrypt,
     hasKey,
   );
   ```

4. Add to return object:
   ```typescript
   siblingGroups: siblingGroupsQuery.data ?? EMPTY_MAP as Map<string, DecryptedSiblingGroup>,
   ```

5. Import `SiblingGroupData` from domain types and `getSiblingGroups` from api.

**Step 2: Add to useTreeMutations**

In `frontend/src/hooks/useTreeMutations.ts`:

1. Add mutations using `useLinkedEntityMutations` (following turningPoints pattern):
   ```typescript
   const siblingGroups = useLinkedEntityMutations<SiblingGroupData>(
     treeId,
     treeQueryKeys.siblingGroups(treeId),
     { create: createSiblingGroup, update: updateSiblingGroup, delete: deleteSiblingGroup },
     encrypt,
   );
   ```

2. Add to return object:
   ```typescript
   siblingGroupMutations: siblingGroups,
   ```

3. Add `siblingGroups` to the person delete cascading invalidation list.

4. Import the API functions.

**Step 3: Verify types compile**

```bash
docker compose exec frontend npx tsc --noEmit
```

**Step 4: Run existing tests**

```bash
docker compose exec frontend npx vitest run
```

**Step 5: Commit**

```bash
git add frontend/src/hooks/useTreeData.ts frontend/src/hooks/useTreeMutations.ts
git commit -m "feat: add sibling group data loading and mutations"
```

---

### Task 8: SiblingGroupNode React Flow component

**Files:**
- Create: `frontend/src/components/tree/SiblingGroupNode.tsx`
- Create: `frontend/src/components/tree/SiblingGroupNode.css`

**Step 1: Create the component**

Create `frontend/src/components/tree/SiblingGroupNode.tsx`:

```tsx
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import "./SiblingGroupNode.css";

export interface SiblingGroupNodeData {
  group: DecryptedSiblingGroup;
}

const MAX_NAMED_DISPLAY = 4;

export default function SiblingGroupNode({
  data,
  selected,
}: NodeProps & { data: SiblingGroupNodeData }) {
  const { t } = useTranslation();
  const { group } = data;
  const totalCount = group.person_ids.length + group.members.length;
  const namedMembers = group.members.filter((m) => m.name.trim() !== "");

  return (
    <div className={`sibling-group-node${selected ? " sibling-group-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="sibling-group-node__handle" />
      {namedMembers.length > 0 && namedMembers.length <= MAX_NAMED_DISPLAY ? (
        <div className="sibling-group-node__names">
          {namedMembers.map((m, i) => (
            <span key={i} className="sibling-group-node__name">
              {m.name}
            </span>
          ))}
        </div>
      ) : (
        <span className="sibling-group-node__label">
          {t("siblingGroup.label", { count: totalCount })}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="sibling-group-node__handle" />
    </div>
  );
}
```

**Step 2: Create the CSS**

Create `frontend/src/components/tree/SiblingGroupNode.css`:

```css
.sibling-group-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  max-width: 180px;
  padding: 6px 14px;
  border: 1px dashed var(--color-border-secondary);
  border-radius: 20px;
  background: var(--color-bg-secondary);
  opacity: 0.85;
  cursor: pointer;
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.sibling-group-node:hover {
  opacity: 1;
  border-color: var(--color-border-primary);
}

.sibling-group-node--selected {
  border-color: var(--color-node-selected);
  opacity: 1;
  box-shadow: 0 0 0 2px var(--color-accent-focus-ring);
}

.sibling-group-node__label {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.sibling-group-node__names {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
}

.sibling-group-node__name {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

.sibling-group-node__handle {
  width: 8px;
  height: 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-secondary);
  border-radius: 50%;
}
```

**Step 3: Create unit test**

Create `frontend/src/components/tree/SiblingGroupNode.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import SiblingGroupNode from "./SiblingGroupNode";
import type { SiblingGroupNodeData } from "./SiblingGroupNode";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      k === "siblingGroup.label" ? `siblings (${opts?.count})` : k,
  }),
}));

vi.mock("@xyflow/react", () => ({
  Handle: ({ position }: { position: string }) => <div data-testid={`handle-${position}`} />,
  Position: { Top: "top", Bottom: "bottom" },
}));

function makeGroup(overrides: Partial<DecryptedSiblingGroup> = {}): DecryptedSiblingGroup {
  return {
    id: "g1",
    person_ids: ["p1"],
    members: [],
    ...overrides,
  };
}

function renderNode(data: SiblingGroupNodeData, selected = false) {
  return render(
    <SiblingGroupNode data={data} selected={selected} id="" type="" dragging={false} />,
  );
}

describe("SiblingGroupNode", () => {
  it("shows count label when no named members", () => {
    renderNode({ group: makeGroup({ members: [{ name: "", birth_year: null }] }) });
    expect(screen.getByText("siblings (2)")).toBeInTheDocument();
  });

  it("shows name list when 4 or fewer named members", () => {
    renderNode({
      group: makeGroup({
        person_ids: [],
        members: [
          { name: "Alice", birth_year: 1990 },
          { name: "Bob", birth_year: 1992 },
        ],
      }),
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows count label when more than 4 named members", () => {
    renderNode({
      group: makeGroup({
        person_ids: [],
        members: [
          { name: "A", birth_year: null },
          { name: "B", birth_year: null },
          { name: "C", birth_year: null },
          { name: "D", birth_year: null },
          { name: "E", birth_year: null },
        ],
      }),
    });
    expect(screen.getByText("siblings (5)")).toBeInTheDocument();
  });

  it("applies selected class", () => {
    const { container } = renderNode({ group: makeGroup() }, true);
    expect(container.querySelector(".sibling-group-node--selected")).toBeTruthy();
  });
});
```

**Step 4: Run tests**

```bash
docker compose exec frontend npx vitest run src/components/tree/SiblingGroupNode.test.tsx
```

**Step 5: Commit**

```bash
git add frontend/src/components/tree/SiblingGroupNode.tsx frontend/src/components/tree/SiblingGroupNode.css frontend/src/components/tree/SiblingGroupNode.test.tsx
git commit -m "feat: add SiblingGroupNode React Flow component"
```

---

### Task 9: Layout integration (Dagre + React Flow node type)

**Files:**
- Modify: `frontend/src/lib/treeLayoutHelpers.ts`
- Modify: `frontend/src/hooks/useTreeLayout.ts`
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx`

**Step 1: Add sibling group node type constant**

In `frontend/src/lib/treeLayoutHelpers.ts`:

1. Add a constant for the sibling group node dimensions:
   ```typescript
   export const SIBLING_GROUP_NODE_WIDTH = 140;
   export const SIBLING_GROUP_NODE_HEIGHT = 50;
   ```

2. Add a `SiblingGroupNodeData` import from the node component.

3. Add a new exported type:
   ```typescript
   export type SiblingGroupNodeType = Node<SiblingGroupNodeData, "siblingGroup">;
   ```

4. Add a `buildSiblingGroupNodes` function that:
   - For each sibling group, determines connection strategy:
     - If any person in `person_ids` has a parent in the tree, connect to that parent (as a child)
     - Otherwise, connect to the first person in `person_ids` (horizontal sibling edge)
   - Adds the group as a dagre node and appropriate edges
   - Returns the React Flow nodes and edges

```typescript
export function buildSiblingGroupNodes(
  siblingGroups: Map<string, DecryptedSiblingGroup>,
  graph: dagre.graphlib.Graph,
  relationships: Map<string, DecryptedRelationship>,
  persons: Map<string, DecryptedPerson>,
): { nodes: SiblingGroupNodeType[]; edges: Edge[] } {
  const nodes: SiblingGroupNodeType[] = [];
  const edges: Edge[] = [];

  // Build child-to-parents lookup from relationships
  const childToParents = new Map<string, string[]>();
  for (const rel of relationships.values()) {
    if (PARENT_TYPES.has(rel.type)) {
      const parents = childToParents.get(rel.target_person_id) ?? [];
      parents.push(rel.source_person_id);
      childToParents.set(rel.target_person_id, parents);
    }
  }

  for (const group of siblingGroups.values()) {
    if (group.person_ids.length === 0) continue;

    const nodeId = `sibling-group-${group.id}`;

    // Find a parent of any person in the group
    let parentId: string | null = null;
    for (const pid of group.person_ids) {
      const parents = childToParents.get(pid);
      if (parents && parents.length > 0 && graph.hasNode(parents[0])) {
        parentId = parents[0];
        break;
      }
    }

    // Add node to dagre graph
    graph.setNode(nodeId, {
      width: SIBLING_GROUP_NODE_WIDTH,
      height: SIBLING_GROUP_NODE_HEIGHT,
    });

    if (parentId) {
      // Connect as child of parent
      graph.setEdge(parentId, nodeId);
    } else {
      // Connect horizontally to anchor person with minlen: 0
      graph.setEdge(group.person_ids[0], nodeId, { minlen: 0 });
    }

    // Get position after layout (will be set after dagre.layout runs)
    const pos = graph.node(nodeId);
    nodes.push({
      id: nodeId,
      type: "siblingGroup",
      position: { x: (pos?.x ?? 0) - SIBLING_GROUP_NODE_WIDTH / 2, y: pos?.y ?? 0 },
      data: { group },
    });

    // Build dashed edge
    const targetNode = parentId ?? group.person_ids[0];
    edges.push({
      id: `edge-sg-${group.id}`,
      source: parentId ?? group.person_ids[0],
      target: nodeId,
      type: "default",
      style: {
        strokeDasharray: "6 3",
        opacity: 0.6,
      },
    });
  }

  return { nodes, edges };
}
```

Note: The sibling group nodes need to be added to the dagre graph BEFORE `dagre.layout()` runs. This means the function needs to be called at the right point in the layout pipeline. We need to integrate the node addition into `layoutDagreGraph` or call it before layout runs.

The better approach is to:
1. Add sibling group nodes to the dagre graph inside `layoutDagreGraph` (before `dagre.layout(graph)`)
2. Build the React Flow nodes after layout (like person nodes)

Refactor: pass `siblingGroups` into `layoutDagreGraph`. Add the sibling group dagre nodes and edges before calling `dagre.layout(graph)`. Then in `buildSiblingGroupNodes`, just read positions from the already-laid-out graph.

**Step 2: Modify `layoutDagreGraph`**

Add `siblingGroups` parameter to `layoutDagreGraph`. Before `dagre.layout(graph)`:

```typescript
// Add sibling group nodes
for (const group of siblingGroups.values()) {
  if (group.person_ids.length === 0) continue;
  const nodeId = `sibling-group-${group.id}`;
  graph.setNode(nodeId, { width: SIBLING_GROUP_NODE_WIDTH, height: SIBLING_GROUP_NODE_HEIGHT });

  // Find parent connection
  let connected = false;
  for (const pid of group.person_ids) {
    const parents = childToParents.get(pid);
    if (parents) {
      for (const parentId of parents) {
        if (graph.hasNode(parentId)) {
          graph.setEdge(parentId, nodeId);
          connected = true;
          break;
        }
      }
    }
    if (connected) break;
  }
  if (!connected && graph.hasNode(group.person_ids[0])) {
    graph.setEdge(group.person_ids[0], nodeId, { minlen: 0 });
  }
}
```

Need to build `childToParents` from relationships early in the function (before the loop).

**Step 3: Add `buildSiblingGroupNodes` to extract positions after layout**

After `dagre.layout(graph)` runs, extract sibling group node positions:

```typescript
export function buildSiblingGroupNodes(
  siblingGroups: Map<string, DecryptedSiblingGroup>,
  graph: dagre.graphlib.Graph,
): SiblingGroupNodeType[] {
  const nodes: SiblingGroupNodeType[] = [];
  for (const group of siblingGroups.values()) {
    if (group.person_ids.length === 0) continue;
    const nodeId = `sibling-group-${group.id}`;
    const pos = graph.node(nodeId);
    if (!pos) continue;
    nodes.push({
      id: nodeId,
      type: "siblingGroup",
      position: { x: pos.x - SIBLING_GROUP_NODE_WIDTH / 2, y: pos.y - SIBLING_GROUP_NODE_HEIGHT / 2 },
      data: { group },
    });
  }
  return nodes;
}
```

**Step 4: Build dashed edges for sibling groups**

```typescript
export function buildSiblingGroupEdges(
  siblingGroups: Map<string, DecryptedSiblingGroup>,
  relationships: Map<string, DecryptedRelationship>,
  graph: dagre.graphlib.Graph,
): Edge[] {
  const edges: Edge[] = [];
  const childToParents = new Map<string, string[]>();
  for (const rel of relationships.values()) {
    if (PARENT_TYPES.has(rel.type)) {
      const parents = childToParents.get(rel.target_person_id) ?? [];
      parents.push(rel.source_person_id);
      childToParents.set(rel.target_person_id, parents);
    }
  }

  for (const group of siblingGroups.values()) {
    if (group.person_ids.length === 0) continue;
    const nodeId = `sibling-group-${group.id}`;
    if (!graph.node(nodeId)) continue;

    let sourceId: string | null = null;
    for (const pid of group.person_ids) {
      const parents = childToParents.get(pid);
      if (parents) {
        for (const parentId of parents) {
          if (graph.hasNode(parentId)) {
            sourceId = parentId;
            break;
          }
        }
      }
      if (sourceId) break;
    }
    if (!sourceId) sourceId = group.person_ids[0];

    edges.push({
      id: `edge-sg-${group.id}`,
      source: sourceId,
      target: nodeId,
      style: {
        stroke: "var(--color-edge-default)",
        strokeDasharray: "6 3",
        opacity: 0.5,
      },
    });
  }

  return edges;
}
```

**Step 5: Integrate into `useTreeLayout`**

In `frontend/src/hooks/useTreeLayout.ts`, update `_computeLayout`:

1. Add `siblingGroups` parameter
2. Pass to `layoutDagreGraph`
3. Call `buildSiblingGroupNodes` and `buildSiblingGroupEdges`
4. Merge sibling group nodes and edges into the returned arrays

**Step 6: Register the node type in TreeWorkspacePage**

In `frontend/src/pages/TreeWorkspacePage.tsx`:

1. Import `SiblingGroupNode`:
   ```typescript
   import SiblingGroupNode from "../components/tree/SiblingGroupNode";
   ```

2. Add to node types (defined outside component):
   ```typescript
   const nodeTypes = {
     person: PersonNode,
     siblingGroup: SiblingGroupNode,
   };
   ```

3. Pass `siblingGroups` from `useTreeData` to `useTreeLayout`

4. Handle click on sibling group node to open the detail panel

**Step 7: Verify**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec frontend npx vitest run
```

**Step 8: Commit**

```bash
git add frontend/src/lib/treeLayoutHelpers.ts frontend/src/hooks/useTreeLayout.ts frontend/src/pages/TreeWorkspacePage.tsx
git commit -m "feat: integrate sibling group nodes into tree layout"
```

---

### Task 10: Sibling group detail panel

**Files:**
- Create: `frontend/src/components/tree/SiblingGroupPanel.tsx`
- Create: `frontend/src/components/tree/SiblingGroupPanel.css`

**Step 1: Create the panel component**

Create `frontend/src/components/tree/SiblingGroupPanel.tsx`. This panel slides in from the right (like PersonDetailPanel) and allows:
- Viewing all members (name + birth year)
- Adding new members (repeating row form)
- Removing members
- Promoting a member to a full Person (calls a handler)
- Deleting the group

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import type { SiblingGroupMember } from "../../types/domain";
import "./SiblingGroupPanel.css";

interface SiblingGroupPanelProps {
  group: DecryptedSiblingGroup;
  onSave: (groupId: string, members: SiblingGroupMember[], personIds: string[]) => void;
  onDelete: (groupId: string) => void;
  onPromote: (groupId: string, memberIndex: number) => void;
  onClose: () => void;
}

export default function SiblingGroupPanel({
  group,
  onSave,
  onDelete,
  onPromote,
  onClose,
}: SiblingGroupPanelProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<SiblingGroupMember[]>(group.members);

  function addRow() {
    setMembers((prev) => [...prev, { name: "", birth_year: null }]);
  }

  function removeRow(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMember(index: number, field: keyof SiblingGroupMember, value: string) {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        if (field === "birth_year") {
          return { ...m, birth_year: value ? parseInt(value, 10) : null };
        }
        return { ...m, [field]: value };
      }),
    );
  }

  function handleSave() {
    onSave(group.id, members, group.person_ids);
  }

  const totalCount = group.person_ids.length + members.length;

  return (
    <div className="sibling-group-panel">
      <div className="sibling-group-panel__header">
        <h3>{t("siblingGroup.title")}</h3>
        <button type="button" className="btn btn--small" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
      <p className="sibling-group-panel__count">
        {t("siblingGroup.totalCount", { count: totalCount })}
      </p>
      <div className="sibling-group-panel__members">
        {members.map((member, index) => (
          <div key={index} className="sibling-group-panel__row">
            <input
              type="text"
              placeholder={t("siblingGroup.namePlaceholder")}
              value={member.name}
              onChange={(e) => updateMember(index, "name", e.target.value)}
              className="input input--small"
            />
            <input
              type="number"
              placeholder={t("siblingGroup.yearPlaceholder")}
              value={member.birth_year ?? ""}
              onChange={(e) => updateMember(index, "birth_year", e.target.value)}
              className="input input--small sibling-group-panel__year"
            />
            <button
              type="button"
              className="btn btn--small"
              onClick={() => onPromote(group.id, index)}
              title={t("siblingGroup.promote")}
            >
              {t("siblingGroup.promote")}
            </button>
            <button
              type="button"
              className="btn btn--small btn--danger"
              onClick={() => removeRow(index)}
            >
              {t("common.remove")}
            </button>
          </div>
        ))}
      </div>
      <div className="sibling-group-panel__actions">
        <button type="button" className="btn btn--small" onClick={addRow}>
          {t("siblingGroup.addMember")}
        </button>
      </div>
      <div className="sibling-group-panel__footer">
        <button type="button" className="btn btn--primary" onClick={handleSave}>
          {t("common.save")}
        </button>
        <button type="button" className="btn btn--danger btn--small" onClick={() => onDelete(group.id)}>
          {t("siblingGroup.deleteGroup")}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create CSS**

Create `frontend/src/components/tree/SiblingGroupPanel.css`:

```css
.sibling-group-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 400px;
  height: 100%;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border-primary);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  z-index: 10;
  animation: panel-slide-in 0.25s ease-out;
}

.sibling-group-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sibling-group-panel__header h3 {
  font-family: var(--font-heading);
  font-weight: 300;
  margin: 0;
}

.sibling-group-panel__count {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.sibling-group-panel__members {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sibling-group-panel__row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.sibling-group-panel__year {
  width: 70px;
}

.sibling-group-panel__actions {
  padding-top: 4px;
}

.sibling-group-panel__footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-primary);
  margin-top: auto;
}
```

**Step 3: Write unit test**

Create `frontend/src/components/tree/SiblingGroupPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import SiblingGroupPanel from "./SiblingGroupPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (k === "siblingGroup.totalCount") return `${opts?.count} siblings`;
      return k;
    },
  }),
}));

function makeGroup(overrides: Partial<DecryptedSiblingGroup> = {}): DecryptedSiblingGroup {
  return {
    id: "g1",
    person_ids: ["p1"],
    members: [{ name: "Alice", birth_year: 1990 }],
    ...overrides,
  };
}

describe("SiblingGroupPanel", () => {
  it("renders member rows", () => {
    render(
      <SiblingGroupPanel
        group={makeGroup()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onPromote={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1990")).toBeInTheDocument();
  });

  it("shows total count", () => {
    render(
      <SiblingGroupPanel
        group={makeGroup()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onPromote={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("2 siblings")).toBeInTheDocument();
  });

  it("calls onSave with updated members", () => {
    const onSave = vi.fn();
    render(
      <SiblingGroupPanel
        group={makeGroup()}
        onSave={onSave}
        onDelete={vi.fn()}
        onPromote={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const nameInput = screen.getByDisplayValue("Alice");
    fireEvent.change(nameInput, { target: { value: "Alicia" } });
    fireEvent.click(screen.getByText("common.save"));
    expect(onSave).toHaveBeenCalledWith("g1", [{ name: "Alicia", birth_year: 1990 }], ["p1"]);
  });

  it("adds a new member row", () => {
    render(
      <SiblingGroupPanel
        group={makeGroup({ members: [] })}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onPromote={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("siblingGroup.addMember"));
    expect(screen.getAllByPlaceholderText("siblingGroup.namePlaceholder")).toHaveLength(1);
  });

  it("calls onPromote with correct index", () => {
    const onPromote = vi.fn();
    render(
      <SiblingGroupPanel
        group={makeGroup()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onPromote={onPromote}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("siblingGroup.promote"));
    expect(onPromote).toHaveBeenCalledWith("g1", 0);
  });

  it("removes a member row", () => {
    render(
      <SiblingGroupPanel
        group={makeGroup()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onPromote={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("common.remove"));
    expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
  });

  it("calls onDelete", () => {
    const onDelete = vi.fn();
    render(
      <SiblingGroupPanel
        group={makeGroup()}
        onSave={vi.fn()}
        onDelete={onDelete}
        onPromote={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("siblingGroup.deleteGroup"));
    expect(onDelete).toHaveBeenCalledWith("g1");
  });
});
```

**Step 4: Run tests**

```bash
docker compose exec frontend npx vitest run src/components/tree/SiblingGroupPanel.test.tsx
```

**Step 5: Commit**

```bash
git add frontend/src/components/tree/SiblingGroupPanel.tsx frontend/src/components/tree/SiblingGroupPanel.css frontend/src/components/tree/SiblingGroupPanel.test.tsx
git commit -m "feat: add SiblingGroupPanel for editing sibling groups"
```

---

### Task 11: RelationshipsTab integration

**Files:**
- Modify: `frontend/src/components/tree/RelationshipsTab.tsx`

**Step 1: Add sibling group section**

In `RelationshipsTab.tsx`, add props for sibling group data:

```typescript
interface RelationshipsTabProps {
  // ... existing props
  siblingGroup: DecryptedSiblingGroup | null;
  onCreateSiblingGroup: () => void;
  onOpenSiblingGroup: (groupId: string) => void;
}
```

After the inferred siblings section, add a sibling group section:

```tsx
<div className="relationships-tab__section">
  <h4>{t("siblingGroup.section")}</h4>
  {siblingGroup ? (
    <button
      type="button"
      className="btn btn--small"
      onClick={() => onOpenSiblingGroup(siblingGroup.id)}
    >
      {t("siblingGroup.edit", { count: siblingGroup.person_ids.length + siblingGroup.members.length })}
    </button>
  ) : (
    <button type="button" className="btn btn--small" onClick={onCreateSiblingGroup}>
      {t("siblingGroup.add")}
    </button>
  )}
</div>
```

**Step 2: Wire up in TreeWorkspacePage / WorkspacePanelHost**

Pass the sibling group data and handlers through to RelationshipsTab via PersonDetailPanel. The sibling group for the selected person is found by checking which group contains the person's ID in its `person_ids`.

**Step 3: Run tests**

```bash
docker compose exec frontend npx vitest run
```

**Step 4: Commit**

```bash
git add frontend/src/components/tree/RelationshipsTab.tsx
git commit -m "feat: add sibling group section to RelationshipsTab"
```

---

### Task 12: Promotion flow

**Files:**
- Modify: `frontend/src/pages/TreeWorkspacePage.tsx` (or a new hook)

**Step 1: Implement the promotion handler**

The promotion flow for a sibling group member:
1. Create a new Person with the member's name and birth_year
2. Create biological sibling relationships between the new person and all persons in `person_ids`
3. Add the new person to the group's `person_ids`
4. Remove the member from the `members` array
5. All in a single `syncTree` call

```typescript
async function handlePromoteMember(groupId: string, memberIndex: number) {
  const group = siblingGroups.get(groupId);
  if (!group) return;
  const member = group.members[memberIndex];

  const newPersonId = crypto.randomUUID();
  const personData: Person = {
    name: member.name || t("siblingGroup.unnamedSibling"),
    birth_year: member.birth_year,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "unknown",
    is_adopted: false,
    notes: null,
  };

  const encryptedPerson = await encrypt(personData, treeId);

  // Build sibling relationships
  const relationshipsCreate = group.person_ids.map((pid) => ({
    encrypted_data: encrypt({ type: RelationshipType.BiologicalSibling, periods: [], active_period: null }, treeId),
    source_person_id: newPersonId,
    target_person_id: pid,
  }));

  // Build updated group
  const updatedMembers = group.members.filter((_, i) => i !== memberIndex);
  const updatedPersonIds = [...group.person_ids, newPersonId];
  const encryptedGroup = await encrypt({ members: updatedMembers }, treeId);

  // Note: need to await all encrypt calls
  const encryptedRels = await Promise.all(
    group.person_ids.map(async (pid) => ({
      encrypted_data: await encrypt(
        { type: RelationshipType.BiologicalSibling, periods: [], active_period: null },
        treeId,
      ),
      source_person_id: newPersonId,
      target_person_id: pid,
    })),
  );

  await syncTree(treeId, {
    persons_create: [{ id: newPersonId, encrypted_data: encryptedPerson }],
    relationships_create: encryptedRels,
    sibling_groups_update: [{
      id: groupId,
      person_ids: updatedPersonIds,
      encrypted_data: encryptedGroup,
    }],
  });

  // Invalidate all relevant queries
  queryClient.invalidateQueries({ queryKey: treeQueryKeys.persons(treeId) });
  queryClient.invalidateQueries({ queryKey: treeQueryKeys.relationships(treeId) });
  queryClient.invalidateQueries({ queryKey: treeQueryKeys.siblingGroups(treeId) });
}
```

**Step 2: Write test for promotion flow**

Add a test (in `TreeWorkspacePage.test.tsx` or a dedicated test file) that verifies the sync call contains the correct person create, relationship creates, and group update.

**Step 3: Verify**

```bash
docker compose exec frontend npx vitest run
docker compose exec frontend npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add frontend/src/pages/TreeWorkspacePage.tsx
git commit -m "feat: implement sibling group member promotion flow"
```

---

### Task 13: i18n keys

**Files:**
- Modify: `frontend/public/locales/en/translation.json`
- Modify: `frontend/public/locales/nl/translation.json`

**Step 1: Add English keys**

```json
"siblingGroup.label": "siblings ({{count}})",
"siblingGroup.title": "Sibling Group",
"siblingGroup.section": "Sibling Group",
"siblingGroup.add": "Add sibling group",
"siblingGroup.edit": "Edit sibling group ({{count}})",
"siblingGroup.addMember": "Add sibling",
"siblingGroup.promote": "Promote",
"siblingGroup.deleteGroup": "Delete group",
"siblingGroup.totalCount_one": "{{count}} sibling total",
"siblingGroup.totalCount_other": "{{count}} siblings total",
"siblingGroup.namePlaceholder": "Name",
"siblingGroup.yearPlaceholder": "Year",
"siblingGroup.unnamedSibling": "Unnamed sibling"
```

**Step 2: Add Dutch keys**

```json
"siblingGroup.label": "broers/zussen ({{count}})",
"siblingGroup.title": "Broers en zussen",
"siblingGroup.section": "Broers en zussen",
"siblingGroup.add": "Groep toevoegen",
"siblingGroup.edit": "Groep bewerken ({{count}})",
"siblingGroup.addMember": "Toevoegen",
"siblingGroup.promote": "Promoveren",
"siblingGroup.deleteGroup": "Groep verwijderen",
"siblingGroup.totalCount_one": "{{count}} broer/zus totaal",
"siblingGroup.totalCount_other": "{{count}} broers/zussen totaal",
"siblingGroup.namePlaceholder": "Naam",
"siblingGroup.yearPlaceholder": "Jaar",
"siblingGroup.unnamedSibling": "Onbenoemde broer/zus"
```

**Step 3: Commit**

```bash
git add frontend/public/locales/en/translation.json frontend/public/locales/nl/translation.json
git commit -m "feat: add sibling group i18n keys (en + nl)"
```

---

### Task 14: Update person delete cascade

**Files:**
- Modify: `frontend/src/hooks/useTreeMutations.ts`

**Step 1: Add siblingGroups to delete cascade**

In the `deletePersonMutation`, add `treeQueryKeys.siblingGroups(treeId)` to the list of query keys invalidated on person delete.

**Step 2: Run tests**

```bash
docker compose exec frontend npx vitest run
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useTreeMutations.ts
git commit -m "feat: cascade sibling group cache invalidation on person delete"
```

---

### Task 15: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

**Step 1: Add SiblingGroup to domain model section**

Add after the Pattern section:

```markdown
### SiblingGroup
- `id`: UUID
- `person_ids`: list of UUIDs (full Person nodes in this sibling group)
- `members`: list of `{ name, birth_year }` (lightweight siblings not in the tree)

Compact representation of siblings without creating full Person nodes. One group per person constraint (server-side 409). Members can be promoted to full persons via bulk sync. Renders as a pill node on the canvas.
```

**Step 2: Add API endpoints**

```markdown
- `GET/POST/PUT/DELETE /trees/{id}/sibling-groups`
```

**Step 3: Add to Implemented scope**

Add "Sibling groups (compact sibling representation, promotion to full persons)" to the Implemented list.

**Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add sibling groups to project documentation"
```

---

### Task 16: Final verification

**Step 1: Run all backend tests**

```bash
docker compose exec api uv run pytest -x -q
```

**Step 2: Run all frontend tests**

```bash
docker compose exec frontend npx vitest run
```

**Step 3: Type checks**

```bash
docker compose exec frontend npx tsc --noEmit
docker compose exec api uv run mypy app/
```

**Step 4: Quality checks**

```bash
make complexity
make quality
```

**Step 5: Lint**

```bash
docker compose exec frontend npx @biomejs/biome ci src/
docker compose exec api uv run ruff check app/
```

**Step 6: Security check**

```bash
docker compose exec api uv run bandit -r app/
```
