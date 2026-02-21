import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.tree import Tree
from app.models.turning_point import TurningPoint, TurningPointPerson
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
