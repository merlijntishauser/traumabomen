import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.event import EventPerson, TraumaEvent
from app.models.tree import Tree
from app.routers.crud_helpers import (
    EntityConfig,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
)
from app.schemas.tree import EventCreate, EventResponse, EventUpdate

router = APIRouter(prefix="/trees/{tree_id}/events", tags=["events"])

_config = EntityConfig(
    model=TraumaEvent,
    junction_model=EventPerson,
    junction_fk="event_id",
    response_schema=EventResponse,
    not_found_detail="Event not found",
)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)  # type: ignore[return-value]


@router.get("", response_model=list[EventResponse])
async def list_events(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
    return await list_entities(_config, tree.id, db)  # type: ignore[return-value]


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    return await get_entity(_config, event_id, tree.id, db)  # type: ignore[return-value]


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    return await update_entity(  # type: ignore[return-value]
        _config, event_id, tree.id, body.encrypted_data, body.person_ids, db
    )


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, event_id, tree.id, db)
