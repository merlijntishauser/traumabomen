"""Sibling groups CRUD router with per-tree person uniqueness constraint.

A person can belong to at most one SiblingGroup per tree. The create and
update endpoints enforce this by checking the SiblingGroupPerson junction
table before persisting, returning HTTP 409 on violation.
"""

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
)
from app.schemas.tree import SiblingGroupCreate, SiblingGroupResponse, SiblingGroupUpdate

router = APIRouter(prefix="/trees/{tree_id}/sibling-groups", tags=["sibling-groups"])

_config = EntityConfig(
    model=SiblingGroup,
    junction_model=SiblingGroupPerson,
    junction_fk="sibling_group_id",
    response_schema=SiblingGroupResponse,
    not_found_detail="Sibling group not found",
)


async def _check_person_uniqueness(
    person_ids: list[uuid.UUID],
    tree_id: uuid.UUID,
    db: AsyncSession,
    exclude_group_id: uuid.UUID | None = None,
) -> None:
    """Raise HTTP 409 if any person is already in another sibling group in this tree."""
    if not person_ids:
        return

    query = (
        select(SiblingGroupPerson.person_id)
        .join(SiblingGroup, SiblingGroupPerson.sibling_group_id == SiblingGroup.id)
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
            detail=f"Persons already in another sibling group: {[str(c) for c in conflicts]}",
        )


@router.post("", response_model=SiblingGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_sibling_group(
    body: SiblingGroupCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SiblingGroupResponse:
    await _check_person_uniqueness(body.person_ids, tree.id, db)
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)


@router.get("", response_model=list[SiblingGroupResponse])
async def list_sibling_groups(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[SiblingGroupResponse]:
    return await list_entities(_config, tree.id, db)


@router.get("/{entity_id}", response_model=SiblingGroupResponse)
async def get_sibling_group(
    entity_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SiblingGroupResponse:
    return await get_entity(_config, entity_id, tree.id, db)


@router.put("/{entity_id}", response_model=SiblingGroupResponse)
async def update_sibling_group(
    entity_id: uuid.UUID,
    body: SiblingGroupUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SiblingGroupResponse:
    if body.person_ids is not None:
        await _check_person_uniqueness(body.person_ids, tree.id, db, exclude_group_id=entity_id)
    return await update_entity(
        _config, entity_id, tree.id, body.encrypted_data, body.person_ids, db
    )


@router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sibling_group(
    entity_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, entity_id, tree.id, db)
