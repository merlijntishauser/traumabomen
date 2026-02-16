import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.classification import Classification, ClassificationPerson
from app.models.event import EventPerson, TraumaEvent
from app.models.pattern import Pattern, PatternPerson
from app.models.person import Person
from app.models.relationship import Relationship
from app.models.tree import Tree
from app.schemas.sync import SyncRequest, SyncResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trees/{tree_id}/sync", tags=["sync"])


async def _validate_person_ids_in_tree(
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


async def _delete_by_tree(
    model: type,
    items: list,
    tree_id: uuid.UUID,
    db: AsyncSession,  # type: ignore[type-arg]
) -> int:
    count = 0
    for item in items:
        result = await db.execute(
            select(model).where(model.id == item.id, model.tree_id == tree_id)
        )
        entity = result.scalar_one_or_none()
        if entity is not None:
            await db.delete(entity)
            count += 1
    return count


async def _phase_deletes(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    resp.relationships_deleted = await _delete_by_tree(
        Relationship, body.relationships_delete, tree.id, db
    )
    resp.classifications_deleted = await _delete_by_tree(
        Classification, body.classifications_delete, tree.id, db
    )
    resp.events_deleted = await _delete_by_tree(TraumaEvent, body.events_delete, tree.id, db)
    resp.patterns_deleted = await _delete_by_tree(Pattern, body.patterns_delete, tree.id, db)
    resp.persons_deleted = await _delete_by_tree(Person, body.persons_delete, tree.id, db)
    await db.flush()


def _collect_referenced_person_ids(body: SyncRequest) -> list[uuid.UUID]:
    all_ids: list[uuid.UUID] = []
    for item in body.relationships_create:
        all_ids.extend([item.source_person_id, item.target_person_id])
    for item in body.events_create:
        all_ids.extend(item.person_ids)
    for item in body.classifications_create:
        all_ids.extend(item.person_ids)
    for item in body.patterns_create:
        all_ids.extend(item.person_ids)
    return all_ids


def _add_junction_rows(body: SyncRequest, resp: SyncResponse, db: AsyncSession) -> None:
    for item, event_id in zip(body.events_create, resp.events_created):
        for pid in item.person_ids:
            db.add(EventPerson(event_id=event_id, person_id=pid))
    for item, cls_id in zip(body.classifications_create, resp.classifications_created):
        for pid in item.person_ids:
            db.add(ClassificationPerson(classification_id=cls_id, person_id=pid))
    for item, pat_id in zip(body.patterns_create, resp.patterns_created):
        for pid in item.person_ids:
            db.add(PatternPerson(pattern_id=pat_id, person_id=pid))


def _create_encrypted_entities(
    model: type,
    items: list,
    tree_id: uuid.UUID,
    db: AsyncSession,  # type: ignore[type-arg]
) -> list[uuid.UUID]:
    ids: list[uuid.UUID] = []
    for item in items:
        entity = model(
            id=item.id or uuid.uuid4(),
            tree_id=tree_id,
            encrypted_data=item.encrypted_data,
        )
        db.add(entity)
        ids.append(entity.id)
    return ids


async def _phase_creates(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    resp.persons_created = _create_encrypted_entities(Person, body.persons_create, tree.id, db)
    await db.flush()

    all_person_ids = _collect_referenced_person_ids(body)
    await _validate_person_ids_in_tree(list(set(all_person_ids)), tree.id, db)

    for item in body.relationships_create:
        rel = Relationship(
            id=item.id or uuid.uuid4(),
            tree_id=tree.id,
            source_person_id=item.source_person_id,
            target_person_id=item.target_person_id,
            encrypted_data=item.encrypted_data,
        )
        db.add(rel)
        resp.relationships_created.append(rel.id)

    resp.events_created = _create_encrypted_entities(TraumaEvent, body.events_create, tree.id, db)
    resp.classifications_created = _create_encrypted_entities(
        Classification, body.classifications_create, tree.id, db
    )
    resp.patterns_created = _create_encrypted_entities(Pattern, body.patterns_create, tree.id, db)

    await db.flush()
    _add_junction_rows(body, resp, db)


async def _phase_updates(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.persons_update:
        result = await db.execute(
            select(Person).where(Person.id == item.id, Person.tree_id == tree.id)
        )
        person = result.scalar_one_or_none()
        if person is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Person {item.id} not found",
            )
        person.encrypted_data = item.encrypted_data
        resp.persons_updated += 1

    await _update_relationships(body, tree, db, resp)
    await _update_events(body, tree, db, resp)
    await _update_classifications(body, tree, db, resp)
    await _update_patterns(body, tree, db, resp)


async def _update_relationships(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.relationships_update:
        result = await db.execute(
            select(Relationship).where(Relationship.id == item.id, Relationship.tree_id == tree.id)
        )
        rel = result.scalar_one_or_none()
        if rel is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Relationship {item.id} not found",
            )
        if item.source_person_id is not None:
            await _validate_person_ids_in_tree([item.source_person_id], tree.id, db)
            rel.source_person_id = item.source_person_id
        if item.target_person_id is not None:
            await _validate_person_ids_in_tree([item.target_person_id], tree.id, db)
            rel.target_person_id = item.target_person_id
        if item.encrypted_data is not None:
            rel.encrypted_data = item.encrypted_data
        resp.relationships_updated += 1


async def _update_events(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.events_update:
        result = await db.execute(
            select(TraumaEvent).where(TraumaEvent.id == item.id, TraumaEvent.tree_id == tree.id)
        )
        event = result.scalar_one_or_none()
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {item.id} not found",
            )
        if item.encrypted_data is not None:
            event.encrypted_data = item.encrypted_data
        if item.person_ids is not None:
            await _validate_person_ids_in_tree(item.person_ids, tree.id, db)
            await db.refresh(event, ["person_links"])
            event.person_links.clear()
            await db.flush()
            for pid in item.person_ids:
                db.add(EventPerson(event_id=event.id, person_id=pid))
        resp.events_updated += 1


async def _update_classifications(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.classifications_update:
        result = await db.execute(
            select(Classification).where(
                Classification.id == item.id, Classification.tree_id == tree.id
            )
        )
        classification = result.scalar_one_or_none()
        if classification is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Classification {item.id} not found",
            )
        if item.encrypted_data is not None:
            classification.encrypted_data = item.encrypted_data
        if item.person_ids is not None:
            await _validate_person_ids_in_tree(item.person_ids, tree.id, db)
            await db.refresh(classification, ["person_links"])
            classification.person_links.clear()
            await db.flush()
            for pid in item.person_ids:
                db.add(ClassificationPerson(classification_id=classification.id, person_id=pid))
        resp.classifications_updated += 1


async def _update_patterns(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.patterns_update:
        result = await db.execute(
            select(Pattern).where(Pattern.id == item.id, Pattern.tree_id == tree.id)
        )
        pattern = result.scalar_one_or_none()
        if pattern is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pattern {item.id} not found",
            )
        if item.encrypted_data is not None:
            pattern.encrypted_data = item.encrypted_data
        if item.person_ids is not None:
            await _validate_person_ids_in_tree(item.person_ids, tree.id, db)
            await db.refresh(pattern, ["person_links"])
            pattern.person_links.clear()
            await db.flush()
            for pid in item.person_ids:
                db.add(PatternPerson(pattern_id=pattern.id, person_id=pid))
        resp.patterns_updated += 1


@router.post("", response_model=SyncResponse)
async def sync_tree(
    body: SyncRequest,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    resp = SyncResponse()

    try:
        await _phase_deletes(body, tree, db, resp)
        await _phase_creates(body, tree, db, resp)
        await _phase_updates(body, tree, db, resp)
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        logger.exception("Unexpected error during tree sync (tree_id=%s)", tree.id)
        await db.rollback()
        raise

    return resp
