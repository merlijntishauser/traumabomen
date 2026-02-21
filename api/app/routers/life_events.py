import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.life_event import LifeEvent, LifeEventPerson
from app.models.tree import Tree
from app.routers.crud_helpers import (
    EntityConfig,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
)
from app.schemas.tree import LifeEventCreate, LifeEventResponse, LifeEventUpdate

router = APIRouter(prefix="/trees/{tree_id}/life-events", tags=["life-events"])

_config = EntityConfig(
    model=LifeEvent,
    junction_model=LifeEventPerson,
    junction_fk="life_event_id",
    response_schema=LifeEventResponse,
    not_found_detail="Life event not found",
)


@router.post("", response_model=LifeEventResponse, status_code=status.HTTP_201_CREATED)
async def create_life_event(
    body: LifeEventCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> LifeEventResponse:
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)  # type: ignore[return-value]


@router.get("", response_model=list[LifeEventResponse])
async def list_life_events(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[LifeEventResponse]:
    return await list_entities(_config, tree.id, db)  # type: ignore[return-value]


@router.get("/{life_event_id}", response_model=LifeEventResponse)
async def get_life_event(
    life_event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> LifeEventResponse:
    return await get_entity(_config, life_event_id, tree.id, db)  # type: ignore[return-value]


@router.put("/{life_event_id}", response_model=LifeEventResponse)
async def update_life_event(
    life_event_id: uuid.UUID,
    body: LifeEventUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> LifeEventResponse:
    return await update_entity(
        _config, life_event_id, tree.id, body.encrypted_data, body.person_ids, db
    )  # type: ignore[return-value]


@router.delete("/{life_event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_life_event(
    life_event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, life_event_id, tree.id, db)
