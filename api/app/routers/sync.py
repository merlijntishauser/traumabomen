import logging
import uuid
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete as sa_delete
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
from app.routers.crud_helpers import get_or_404, validate_persons_in_tree
from app.schemas.sync import SyncRequest, SyncResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trees/{tree_id}/sync", tags=["sync"])


@dataclass(frozen=True, slots=True)
class _JunctionSpec:
    """Junction table metadata for entities that link to persons."""

    junction_model: type
    junction_fk: str


@dataclass(frozen=True, slots=True)
class _EntitySpec:
    """Configuration for a single entity type in the sync pipeline."""

    model: type
    prefix: str  # e.g. "events" -> maps to events_create, events_created, etc.
    label: str  # human-readable label for error messages
    junction: _JunctionSpec | None = None


# Entities with person junction tables. Order here determines create/delete order
# (within this group).
_JUNCTION_ENTITY_SPECS: tuple[_EntitySpec, ...] = (
    _EntitySpec(
        TraumaEvent,
        "events",
        "Event",
        _JunctionSpec(EventPerson, "event_id"),
    ),
    _EntitySpec(
        LifeEvent,
        "life_events",
        "LifeEvent",
        _JunctionSpec(LifeEventPerson, "life_event_id"),
    ),
    _EntitySpec(
        Classification,
        "classifications",
        "Classification",
        _JunctionSpec(ClassificationPerson, "classification_id"),
    ),
    _EntitySpec(
        TurningPoint,
        "turning_points",
        "TurningPoint",
        _JunctionSpec(TurningPointPerson, "turning_point_id"),
    ),
    _EntitySpec(
        Pattern,
        "patterns",
        "Pattern",
        _JunctionSpec(PatternPerson, "pattern_id"),
    ),
)

# Simple entities (no junction table, no special fields).
_SIMPLE_ENTITY_SPECS: tuple[_EntitySpec, ...] = (
    _EntitySpec(JournalEntry, "journal_entries", "JournalEntry"),
)

# Delete order: relationships first, then junction entities, then simple entities,
# then persons last (to satisfy FK constraints).
_DELETE_ORDER: tuple[_EntitySpec, ...] = (
    _EntitySpec(Relationship, "relationships", "Relationship"),
    *_JUNCTION_ENTITY_SPECS,
    *_SIMPLE_ENTITY_SPECS,
    _EntitySpec(Person, "persons", "Person"),
)

# All non-relationship, non-person entities that use _create_encrypted_entities.
_BULK_CREATE_SPECS: tuple[_EntitySpec, ...] = (
    *_JUNCTION_ENTITY_SPECS,
    *_SIMPLE_ENTITY_SPECS,
)


def _get_request_list(body: SyncRequest, prefix: str, operation: str) -> list:
    """Get the request list attribute, e.g. body.events_create."""
    return getattr(body, f"{prefix}_{operation}")


def _set_response_count(resp: SyncResponse, prefix: str, suffix: str, value: object) -> None:
    """Set a response attribute, e.g. resp.events_deleted = 5."""
    setattr(resp, f"{prefix}_{suffix}", value)


async def _delete_by_tree(
    model: type,
    items: list,
    tree_id: uuid.UUID,
    db: AsyncSession,  # type: ignore[type-arg]
) -> int:
    if not items:
        return 0
    ids = [item.id for item in items]
    result = await db.execute(sa_delete(model).where(model.id.in_(ids), model.tree_id == tree_id))
    return result.rowcount  # type: ignore[return-value]


async def _phase_deletes(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    for spec in _DELETE_ORDER:
        items = _get_request_list(body, spec.prefix, "delete")
        count = await _delete_by_tree(spec.model, items, tree.id, db)
        _set_response_count(resp, spec.prefix, "deleted", count)
    await db.flush()


def _collect_referenced_person_ids(body: SyncRequest) -> list[uuid.UUID]:
    ids: list[uuid.UUID] = []
    for item in body.relationships_create:
        ids.extend([item.source_person_id, item.target_person_id])
    for spec in _JUNCTION_ENTITY_SPECS:
        for item in _get_request_list(body, spec.prefix, "create"):
            ids.extend(item.person_ids)
    return ids


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


def _add_junction_rows(body: SyncRequest, resp: SyncResponse, db: AsyncSession) -> None:
    for spec in _JUNCTION_ENTITY_SPECS:
        junction = spec.junction
        if junction is None:  # pragma: no cover – always set for junction specs
            continue
        items = _get_request_list(body, spec.prefix, "create")
        entity_ids: list[uuid.UUID] = getattr(resp, f"{spec.prefix}_created")
        for item, entity_id in zip(items, entity_ids):
            for pid in item.person_ids:
                db.add(
                    junction.junction_model(**{junction.junction_fk: entity_id, "person_id": pid})
                )


async def _phase_creates(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    # Persons first (other entities reference them via FKs).
    resp.persons_created = _create_encrypted_entities(Person, body.persons_create, tree.id, db)
    await db.flush()

    all_person_ids = _collect_referenced_person_ids(body)
    await validate_persons_in_tree(list(set(all_person_ids)), tree.id, db)

    # Relationships are special: they carry source_person_id / target_person_id.
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

    # All other entities use the generic encrypted-entity creator.
    for spec in _BULK_CREATE_SPECS:
        items = _get_request_list(body, spec.prefix, "create")
        created_ids = _create_encrypted_entities(spec.model, items, tree.id, db)
        _set_response_count(resp, spec.prefix, "created", created_ids)

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
    return await get_or_404(
        db,
        select(model).where(model.id == entity_id, model.tree_id == tree_id),
        detail=f"{label} {entity_id} not found",
    )


async def _batch_fetch_entities(
    model: type,
    items: list,
    tree_id: uuid.UUID,
    label: str,
    db: AsyncSession,  # type: ignore[type-arg]
) -> dict:
    """Fetch multiple entities in a single query, or raise 404 for missing IDs."""
    if not items:
        return {}
    ids = [item.id for item in items]
    result = await db.execute(select(model).where(model.id.in_(ids), model.tree_id == tree_id))
    entities = {e.id: e for e in result.scalars().all()}
    missing = set(ids) - entities.keys()
    if missing:
        raise HTTPException(status_code=404, detail=f"{label} {next(iter(missing))} not found")
    return entities


async def _update_entities_with_persons(
    items: list,
    model: type,
    junction_model: type,
    junction_fk: str,
    entity_label: str,
    tree: Tree,
    db: AsyncSession,  # type: ignore[type-arg]
) -> int:
    entities = await _batch_fetch_entities(model, items, tree.id, entity_label, db)
    if not entities:
        return 0

    # Collect all person_ids for a single validation call.
    all_person_ids: list[uuid.UUID] = []
    for item in items:
        if item.person_ids is not None:
            all_person_ids.extend(item.person_ids)
    if all_person_ids:
        await validate_persons_in_tree(list(set(all_person_ids)), tree.id, db)

    for item in items:
        entity = entities[item.id]
        if item.encrypted_data is not None:
            entity.encrypted_data = item.encrypted_data
        if item.person_ids is not None:
            # Delete old junction rows and insert new ones.
            await db.execute(
                sa_delete(junction_model).where(getattr(junction_model, junction_fk) == entity.id)
            )
            for pid in item.person_ids:
                db.add(junction_model(**{junction_fk: entity.id, "person_id": pid}))
    return len(items)


async def _update_simple_entities(
    items: list,
    model: type,
    entity_label: str,
    tree: Tree,
    db: AsyncSession,  # type: ignore[type-arg]
) -> int:
    """Update entities that have only encrypted_data (no person links)."""
    entities = await _batch_fetch_entities(model, items, tree.id, entity_label, db)
    for item in items:
        entities[item.id].encrypted_data = item.encrypted_data
    return len(items)


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


async def _phase_updates(
    body: SyncRequest, tree: Tree, db: AsyncSession, resp: SyncResponse
) -> None:
    # Persons: simple encrypted_data update, no junction table.
    resp.persons_updated = await _update_simple_entities(
        body.persons_update, Person, "Person", tree, db
    )

    # Relationships: special handling for source_person_id / target_person_id.
    await _update_relationships(body, tree, db, resp)

    # Junction entities: encrypted_data + person links.
    for spec in _JUNCTION_ENTITY_SPECS:
        junction = spec.junction
        if junction is None:  # pragma: no cover – always set for junction specs
            continue
        items = _get_request_list(body, spec.prefix, "update")
        count = await _update_entities_with_persons(
            items,
            spec.model,
            junction.junction_model,
            junction.junction_fk,
            spec.label,
            tree,
            db,
        )
        _set_response_count(resp, spec.prefix, "updated", count)

    # Simple entities: encrypted_data only, no person links.
    for spec in _SIMPLE_ENTITY_SPECS:
        items = _get_request_list(body, spec.prefix, "update")
        count = await _update_simple_entities(items, spec.model, spec.label, tree, db)
        _set_response_count(resp, spec.prefix, "updated", count)


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
