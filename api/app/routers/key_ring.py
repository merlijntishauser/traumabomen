from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.classification import Classification
from app.models.event import TraumaEvent
from app.models.journal_entry import JournalEntry
from app.models.life_event import LifeEvent
from app.models.pattern import Pattern
from app.models.person import Person
from app.models.relationship import Relationship
from app.models.tree import Tree
from app.models.turning_point import TurningPoint
from app.models.user import User
from app.schemas.auth import KeyRingResponse, KeyRingUpdate, MigrateKeysRequest, MigrateKeysTree

router = APIRouter(prefix="/auth", tags=["auth"])

_ENTITY_MODELS: list[tuple[str, Any]] = [
    ("persons", Person),
    ("relationships", Relationship),
    ("events", TraumaEvent),
    ("life_events", LifeEvent),
    ("turning_points", TurningPoint),
    ("classifications", Classification),
    ("patterns", Pattern),
    ("journal_entries", JournalEntry),
]


@router.get("/key-ring")
async def get_key_ring(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KeyRingResponse:
    if not user.encrypted_key_ring:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No key ring")
    user.last_active_at = datetime.now(UTC)
    await db.commit()
    return KeyRingResponse(encrypted_key_ring=user.encrypted_key_ring)


@router.put("/key-ring", status_code=status.HTTP_200_OK)
async def update_key_ring(
    body: KeyRingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    user.encrypted_key_ring = body.encrypted_key_ring
    await db.commit()
    return {"message": "Key ring updated"}


async def _validate_tree_ownership(tree_ids: list[UUID], user_id: UUID, db: AsyncSession) -> None:
    result = await db.execute(select(Tree).where(Tree.user_id == user_id, Tree.id.in_(tree_ids)))
    owned_trees = {t.id for t in result.scalars().all()}
    for tid in tree_ids:
        if tid not in owned_trees:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tree {tid} not found",
            )


async def _migrate_tree_entities(tree_data: MigrateKeysTree, db: AsyncSession) -> None:
    await db.execute(
        update(Tree)
        .where(Tree.id == tree_data.tree_id)
        .values(encrypted_data=tree_data.encrypted_data)
    )
    for attr, model in _ENTITY_MODELS:
        for entity in getattr(tree_data, attr):
            result = await db.execute(
                update(model)
                .where(
                    model.id == entity.id,
                    model.tree_id == tree_data.tree_id,
                )
                .values(encrypted_data=entity.encrypted_data)
            )
            if result.rowcount == 0:  # type: ignore[attr-defined]
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Entity {entity.id} not found in tree {tree_data.tree_id}",
                )


@router.post("/migrate-keys", status_code=status.HTTP_200_OK)
async def migrate_keys(
    body: MigrateKeysRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    if user.encrypted_key_ring:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already migrated")

    await _validate_tree_ownership([t.tree_id for t in body.trees], user.id, db)
    user.encrypted_key_ring = body.encrypted_key_ring

    for tree_data in body.trees:
        await _migrate_tree_entities(tree_data, db)

    await db.commit()
    return {"message": "Migration complete"}
