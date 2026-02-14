import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.event import EventPerson, TraumaEvent
from app.models.person import Person
from app.models.tree import Tree
from app.schemas.tree import EventCreate, EventResponse, EventUpdate

router = APIRouter(prefix="/trees/{tree_id}/events", tags=["events"])


async def _validate_persons_in_tree(
    person_ids: list[uuid.UUID], tree_id: uuid.UUID, db: AsyncSession
) -> None:
    if not person_ids:
        return
    result = await db.execute(
        select(Person.id).where(Person.tree_id == tree_id, Person.id.in_(person_ids))
    )
    found = {row[0] for row in result.all()}
    missing = set(person_ids) - found
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"person_ids not found in this tree: {[str(m) for m in missing]}",
        )


def _event_response(event: TraumaEvent) -> EventResponse:
    return EventResponse(
        id=event.id,
        person_ids=[link.person_id for link in event.person_links],
        encrypted_data=event.encrypted_data,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    await _validate_persons_in_tree(body.person_ids, tree.id, db)

    event = TraumaEvent(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(event)
    await db.flush()
    for pid in body.person_ids:
        db.add(EventPerson(event_id=event.id, person_id=pid))
    await db.commit()
    await db.refresh(event, ["person_links"])
    return _event_response(event)


@router.get("", response_model=list[EventResponse])
async def list_events(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
    result = await db.execute(
        select(TraumaEvent)
        .where(TraumaEvent.tree_id == tree.id)
        .options(selectinload(TraumaEvent.person_links))
    )
    events = result.scalars().all()
    return [_event_response(e) for e in events]


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    result = await db.execute(
        select(TraumaEvent).where(TraumaEvent.id == event_id, TraumaEvent.tree_id == tree.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await db.refresh(event, ["person_links"])
    return _event_response(event)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    result = await db.execute(
        select(TraumaEvent).where(TraumaEvent.id == event_id, TraumaEvent.tree_id == tree.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if body.encrypted_data is not None:
        event.encrypted_data = body.encrypted_data

    if body.person_ids is not None:
        await _validate_persons_in_tree(body.person_ids, tree.id, db)
        await db.refresh(event, ["person_links"])
        event.person_links.clear()
        await db.flush()
        for pid in body.person_ids:
            db.add(EventPerson(event_id=event.id, person_id=pid))

    await db.commit()
    await db.refresh(event)
    await db.refresh(event, ["person_links"])
    return _event_response(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(TraumaEvent).where(TraumaEvent.id == event_id, TraumaEvent.tree_id == tree.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    await db.delete(event)
    await db.commit()
