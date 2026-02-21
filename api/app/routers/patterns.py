import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.pattern import Pattern, PatternPerson
from app.models.tree import Tree
from app.routers.crud_helpers import (
    EntityConfig,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
)
from app.schemas.tree import PatternCreate, PatternResponse, PatternUpdate

router = APIRouter(prefix="/trees/{tree_id}/patterns", tags=["patterns"])

_config = EntityConfig(
    model=Pattern,
    junction_model=PatternPerson,
    junction_fk="pattern_id",
    response_schema=PatternResponse,
    not_found_detail="Pattern not found",
)


@router.post("", response_model=PatternResponse, status_code=status.HTTP_201_CREATED)
async def create_pattern(
    body: PatternCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PatternResponse:
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)  # type: ignore[return-value]


@router.get("", response_model=list[PatternResponse])
async def list_patterns(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[PatternResponse]:
    return await list_entities(_config, tree.id, db)  # type: ignore[return-value]


@router.get("/{pattern_id}", response_model=PatternResponse)
async def get_pattern(
    pattern_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PatternResponse:
    return await get_entity(_config, pattern_id, tree.id, db)  # type: ignore[return-value]


@router.put("/{pattern_id}", response_model=PatternResponse)
async def update_pattern(
    pattern_id: uuid.UUID,
    body: PatternUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PatternResponse:
    return await update_entity(
        _config, pattern_id, tree.id, body.encrypted_data, body.person_ids, db
    )  # type: ignore[return-value]


@router.delete("/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pattern(
    pattern_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, pattern_id, tree.id, db)
