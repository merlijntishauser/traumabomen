import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.life_event import LifeEvent, LifeEventPerson
from app.models.person import Person
from app.models.tree import Tree
from app.schemas.tree import LifeEventCreate, LifeEventResponse, LifeEventUpdate

router = APIRouter(prefix="/trees/{tree_id}/life-events", tags=["life-events"])


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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"person_ids not found in this tree: {[str(m) for m in missing]}",
        )


def _life_event_response(event: LifeEvent) -> LifeEventResponse:
    return LifeEventResponse(
        id=event.id,
        person_ids=[link.person_id for link in event.person_links],
        encrypted_data=event.encrypted_data,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.post("", response_model=LifeEventResponse, status_code=status.HTTP_201_CREATED)
async def create_life_event(
    body: LifeEventCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> LifeEventResponse:
    await _validate_persons_in_tree(body.person_ids, tree.id, db)

    event = LifeEvent(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(event)
    await db.flush()
    for pid in body.person_ids:
        db.add(LifeEventPerson(life_event_id=event.id, person_id=pid))
    await db.commit()
    await db.refresh(event, ["person_links"])
    return _life_event_response(event)


@router.get("", response_model=list[LifeEventResponse])
async def list_life_events(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[LifeEventResponse]:
    result = await db.execute(select(LifeEvent).where(LifeEvent.tree_id == tree.id))
    events = result.scalars().all()
    for event in events:
        await db.refresh(event, ["person_links"])
    return [_life_event_response(e) for e in events]


@router.get("/{life_event_id}", response_model=LifeEventResponse)
async def get_life_event(
    life_event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> LifeEventResponse:
    result = await db.execute(
        select(LifeEvent).where(LifeEvent.id == life_event_id, LifeEvent.tree_id == tree.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Life event not found")
    await db.refresh(event, ["person_links"])
    return _life_event_response(event)


@router.put("/{life_event_id}", response_model=LifeEventResponse)
async def update_life_event(
    life_event_id: uuid.UUID,
    body: LifeEventUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> LifeEventResponse:
    result = await db.execute(
        select(LifeEvent).where(LifeEvent.id == life_event_id, LifeEvent.tree_id == tree.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Life event not found")

    if body.encrypted_data is not None:
        event.encrypted_data = body.encrypted_data

    if body.person_ids is not None:
        await _validate_persons_in_tree(body.person_ids, tree.id, db)
        await db.refresh(event, ["person_links"])
        event.person_links.clear()
        await db.flush()
        for pid in body.person_ids:
            db.add(LifeEventPerson(life_event_id=event.id, person_id=pid))

    await db.commit()
    await db.refresh(event, ["person_links"])
    return _life_event_response(event)


@router.delete("/{life_event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_life_event(
    life_event_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(LifeEvent).where(LifeEvent.id == life_event_id, LifeEvent.tree_id == tree.id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Life event not found")
    await db.delete(event)
    await db.commit()
