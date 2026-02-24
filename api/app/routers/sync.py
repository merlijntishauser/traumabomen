import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.classification import Classification, ClassificationPerson
from app.models.event import EventPerson, TraumaEvent
from app.models.journal_entry import JournalEntry
from app.models.life_event import LifeEvent, LifeEventPerson
from app.models.pattern import Pattern, PatternPerson
from app.models.person import Person
from app.models.relationship import Relationship
from app.models.tree import Tree
from app.models.turning_point import TurningPoint, TurningPointPerson
from app.routers.crud_helpers import validate_persons_in_tree
from app.schemas.sync import SyncRequest, SyncResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trees/{tree_id}/sync", tags=["sync"])


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
    resp.turning_points_deleted = await _delete_by_tree(
        TurningPoint, body.turning_points_delete, tree.id, db
    )
    resp.life_events_deleted = await _delete_by_tree(
        LifeEvent, body.life_events_delete, tree.id, db
    )
    resp.patterns_deleted = await _delete_by_tree(Pattern, body.patterns_delete, tree.id, db)
    resp.journal_entries_deleted = await _delete_by_tree(
        JournalEntry, body.journal_entries_delete, tree.id, db
    )
    resp.persons_deleted = await _delete_by_tree(Person, body.persons_delete, tree.id, db)
    await db.flush()


def _collect_referenced_person_ids(body: SyncRequest) -> list[uuid.UUID]:
    ids: list[uuid.UUID] = []
    for item in body.relationships_create:
        ids.extend([item.source_person_id, item.target_person_id])
    for entity_list in (
        body.events_create,
        body.life_events_create,
        body.classifications_create,
        body.turning_points_create,
        body.patterns_create,
    ):
        for item in entity_list:
            ids.extend(item.person_ids)
    return ids


def _add_junction_rows(body: SyncRequest, resp: SyncResponse, db: AsyncSession) -> None:
    specs = (
        (body.events_create, resp.events_created, EventPerson, "event_id"),
        (body.life_events_create, resp.life_events_created, LifeEventPerson, "life_event_id"),
        (
            body.classifications_create,
            resp.classifications_created,
            ClassificationPerson,
            "classification_id",
        ),
        (
            body.turning_points_create,
            resp.turning_points_created,
            TurningPointPerson,
            "turning_point_id",
        ),
        (body.patterns_create, resp.patterns_created, PatternPerson, "pattern_id"),
    )
    for items, entity_ids, junction_cls, fk_name in specs:
        for item, entity_id in zip(items, entity_ids):
            for pid in item.person_ids:
                db.add(junction_cls(**{fk_name: entity_id, "person_id": pid}))


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
    await validate_persons_in_tree(list(set(all_person_ids)), tree.id, db)

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
    resp.life_events_created = _create_encrypted_entities(
        LifeEvent, body.life_events_create, tree.id, db
    )
    resp.classifications_created = _create_encrypted_entities(
        Classification, body.classifications_create, tree.id, db
    )
    resp.turning_points_created = _create_encrypted_entities(
        TurningPoint, body.turning_points_create, tree.id, db
    )
    resp.patterns_created = _create_encrypted_entities(Pattern, body.patterns_create, tree.id, db)
    resp.journal_entries_created = _create_encrypted_entities(
        JournalEntry, body.journal_entries_create, tree.id, db
    )

    await db.flush()
    _add_junction_rows(body, resp, db)


async def _fetch_entity(
    model: type,
    entity_id: uuid.UUID,
    tree_id: uuid.UUID,
    label: str,
    db: AsyncSession,  # type: ignore[type-arg]
):
    """Load an entity by id and tree_id, or raise 404."""
    result = await db.execute(select(model).where(model.id == entity_id, model.tree_id == tree_id))
    entity = result.scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} {entity_id} not found"
        )
    return entity


async def _phase_updates(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.persons_update:
        person = await _fetch_entity(Person, item.id, tree.id, "Person", db)
        person.encrypted_data = item.encrypted_data
        resp.persons_updated += 1

    await _update_relationships(body, tree, db, resp)
    resp.events_updated = await _update_entities_with_persons(
        body.events_update, TraumaEvent, EventPerson, "event_id", "Event", tree, db
    )
    resp.classifications_updated = await _update_entities_with_persons(
        body.classifications_update,
        Classification,
        ClassificationPerson,
        "classification_id",
        "Classification",
        tree,
        db,
    )
    resp.turning_points_updated = await _update_entities_with_persons(
        body.turning_points_update,
        TurningPoint,
        TurningPointPerson,
        "turning_point_id",
        "TurningPoint",
        tree,
        db,
    )
    resp.life_events_updated = await _update_entities_with_persons(
        body.life_events_update,
        LifeEvent,
        LifeEventPerson,
        "life_event_id",
        "LifeEvent",
        tree,
        db,
    )
    resp.patterns_updated = await _update_entities_with_persons(
        body.patterns_update, Pattern, PatternPerson, "pattern_id", "Pattern", tree, db
    )
    # Journal entries have no person links
    for item in body.journal_entries_update:
        journal = await _fetch_entity(JournalEntry, item.id, tree.id, "JournalEntry", db)
        journal.encrypted_data = item.encrypted_data
        resp.journal_entries_updated += 1


async def _update_relationships(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for item in body.relationships_update:
        rel = await _fetch_entity(Relationship, item.id, tree.id, "Relationship", db)
        for attr in ("source_person_id", "target_person_id"):
            new_val = getattr(item, attr)
            if new_val is not None:
                await validate_persons_in_tree([new_val], tree.id, db)
                setattr(rel, attr, new_val)
        if item.encrypted_data is not None:
            rel.encrypted_data = item.encrypted_data
        resp.relationships_updated += 1


async def _replace_person_links(
    entity,
    person_ids: list[uuid.UUID],
    junction_model: type,
    junction_fk: str,
    tree_id: uuid.UUID,
    db: AsyncSession,  # type: ignore[type-arg]
) -> None:
    """Replace all person junction rows for an entity."""
    await validate_persons_in_tree(person_ids, tree_id, db)
    await db.refresh(entity, ["person_links"])
    entity.person_links.clear()
    await db.flush()
    for pid in person_ids:
        db.add(junction_model(**{junction_fk: entity.id, "person_id": pid}))


async def _update_entities_with_persons(
    items: list,
    model: type,
    junction_model: type,
    junction_fk: str,
    entity_label: str,
    tree: Tree,
    db: AsyncSession,  # type: ignore[type-arg]
) -> int:
    count = 0
    for item in items:
        entity = await _fetch_entity(model, item.id, tree.id, entity_label, db)
        if item.encrypted_data is not None:
            entity.encrypted_data = item.encrypted_data
        if item.person_ids is not None:
            await _replace_person_links(
                entity, item.person_ids, junction_model, junction_fk, tree.id, db
            )
        count += 1
    return count


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
