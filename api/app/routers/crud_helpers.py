"""Shared CRUD helpers for entity routers with person junction links.

Each entity router (events, life_events, classifications, patterns) follows
the same create/list/get/update/delete pattern. This module extracts that
logic so each router becomes a thin wrapper around an EntityConfig.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from app.models.person import Person
from app.schemas.tree import (
    JournalEntryResponse,
    PersonResponse,
    TreeResponse,
    _LinkedEntityResponse,
)


async def get_or_404[T](db: AsyncSession, query: Select[tuple[T]], detail: str = "Not found") -> T:
    result = await db.execute(query)
    entity = result.scalar_one_or_none()
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return entity  # type: ignore[return-value]


def build_person_response(person: Any) -> PersonResponse:
    return PersonResponse(
        id=person.id,
        encrypted_data=person.encrypted_data,
        created_at=person.created_at,
        updated_at=person.updated_at,
    )


def build_tree_response(tree: Any) -> TreeResponse:
    return TreeResponse(
        id=tree.id,
        encrypted_data=tree.encrypted_data,
        is_demo=tree.is_demo,
        created_at=tree.created_at,
        updated_at=tree.updated_at,
    )


def build_journal_entry_response(entry: Any) -> JournalEntryResponse:
    return JournalEntryResponse(
        id=entry.id,
        encrypted_data=entry.encrypted_data,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@dataclass(frozen=True)
class EntityConfig:
    """Configuration for a CRUD entity with person junction links."""

    model: Any
    junction_model: Any
    junction_fk: str
    response_schema: type[_LinkedEntityResponse]
    not_found_detail: str


async def validate_persons_in_tree(
    person_ids: list[uuid.UUID], tree_id: uuid.UUID, db: AsyncSession
) -> None:
    """Raise 422 if any person_ids are not in the given tree."""
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


def build_entity_response(entity: Any, config: EntityConfig) -> _LinkedEntityResponse:
    """Build a Pydantic response from an entity with person_links."""
    return config.response_schema(
        id=entity.id,
        person_ids=[link.person_id for link in entity.person_links],
        encrypted_data=entity.encrypted_data,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


async def create_entity(
    config: EntityConfig,
    person_ids: list[uuid.UUID],
    encrypted_data: str,
    tree_id: uuid.UUID,
    db: AsyncSession,
) -> _LinkedEntityResponse:
    """Create an entity with junction rows linking to persons."""
    await validate_persons_in_tree(person_ids, tree_id, db)

    entity = config.model(tree_id=tree_id, encrypted_data=encrypted_data)
    db.add(entity)
    await db.flush()
    for pid in person_ids:
        db.add(config.junction_model(**{config.junction_fk: entity.id, "person_id": pid}))
    await db.commit()
    await db.refresh(entity, ["person_links"])
    return build_entity_response(entity, config)


async def list_entities(
    config: EntityConfig,
    tree_id: uuid.UUID,
    db: AsyncSession,
) -> list[_LinkedEntityResponse]:
    """List all entities for a tree, eagerly loading person_links."""
    result = await db.execute(
        select(config.model)
        .where(config.model.tree_id == tree_id)
        .options(selectinload(config.model.person_links))
    )
    entities = result.scalars().all()
    return [build_entity_response(e, config) for e in entities]


async def get_entity(
    config: EntityConfig,
    entity_id: uuid.UUID,
    tree_id: uuid.UUID,
    db: AsyncSession,
) -> _LinkedEntityResponse:
    """Get a single entity by ID, raising 404 if not found."""
    entity = await get_or_404(
        db,
        select(config.model).where(config.model.id == entity_id, config.model.tree_id == tree_id),
        detail=config.not_found_detail,
    )
    await db.refresh(entity, ["person_links"])
    return build_entity_response(entity, config)


async def update_entity(
    config: EntityConfig,
    entity_id: uuid.UUID,
    tree_id: uuid.UUID,
    encrypted_data: str | None,
    person_ids: list[uuid.UUID] | None,
    db: AsyncSession,
) -> _LinkedEntityResponse:
    """Update an entity's encrypted_data and/or person_ids."""
    entity = await get_or_404(
        db,
        select(config.model).where(config.model.id == entity_id, config.model.tree_id == tree_id),
        detail=config.not_found_detail,
    )

    if encrypted_data is not None:
        entity.encrypted_data = encrypted_data

    if person_ids is not None:
        await validate_persons_in_tree(person_ids, tree_id, db)
        await db.refresh(entity, ["person_links"])
        entity.person_links.clear()
        await db.flush()
        for pid in person_ids:
            db.add(config.junction_model(**{config.junction_fk: entity.id, "person_id": pid}))

    await db.commit()
    await db.refresh(entity)
    await db.refresh(entity, ["person_links"])
    return build_entity_response(entity, config)


async def delete_entity(
    config: EntityConfig,
    entity_id: uuid.UUID,
    tree_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Delete an entity by ID, raising 404 if not found."""
    entity = await get_or_404(
        db,
        select(config.model).where(config.model.id == entity_id, config.model.tree_id == tree_id),
        detail=config.not_found_detail,
    )
    await db.delete(entity)
    await db.commit()
