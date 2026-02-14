import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.classification import Classification, ClassificationPerson
from app.models.event import EventPerson, TraumaEvent
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


@router.post("", response_model=SyncResponse)
async def sync_tree(
    body: SyncRequest,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    resp = SyncResponse()

    try:
        # Phase 1: Deletes (relationships -> events -> persons)
        for item in body.relationships_delete:
            result = await db.execute(
                select(Relationship).where(
                    Relationship.id == item.id, Relationship.tree_id == tree.id
                )
            )
            rel = result.scalar_one_or_none()
            if rel is not None:
                await db.delete(rel)
                resp.relationships_deleted += 1

        for item in body.classifications_delete:
            result = await db.execute(
                select(Classification).where(
                    Classification.id == item.id, Classification.tree_id == tree.id
                )
            )
            classification = result.scalar_one_or_none()
            if classification is not None:
                await db.delete(classification)
                resp.classifications_deleted += 1

        for item in body.events_delete:
            result = await db.execute(
                select(TraumaEvent).where(TraumaEvent.id == item.id, TraumaEvent.tree_id == tree.id)
            )
            event = result.scalar_one_or_none()
            if event is not None:
                await db.delete(event)
                resp.events_deleted += 1

        for item in body.persons_delete:
            result = await db.execute(
                select(Person).where(Person.id == item.id, Person.tree_id == tree.id)
            )
            person = result.scalar_one_or_none()
            if person is not None:
                await db.delete(person)
                resp.persons_deleted += 1

        await db.flush()

        # Phase 2: Creates (persons first, then relationships + events)
        for item in body.persons_create:
            person = Person(
                id=item.id or uuid.uuid4(),
                tree_id=tree.id,
                encrypted_data=item.encrypted_data,
            )
            db.add(person)
            resp.persons_created.append(person.id)

        await db.flush()

        # Collect all person IDs referenced by new relationships and events
        rel_person_ids = []
        for item in body.relationships_create:
            rel_person_ids.extend([item.source_person_id, item.target_person_id])
        event_person_ids = []
        for item in body.events_create:
            event_person_ids.extend(item.person_ids)
        classification_person_ids = []
        for item in body.classifications_create:
            classification_person_ids.extend(item.person_ids)

        await _validate_person_ids_in_tree(
            list(set(rel_person_ids + event_person_ids + classification_person_ids)), tree.id, db
        )

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

        for item in body.events_create:
            event = TraumaEvent(
                id=item.id or uuid.uuid4(),
                tree_id=tree.id,
                encrypted_data=item.encrypted_data,
            )
            db.add(event)
            resp.events_created.append(event.id)

        for item in body.classifications_create:
            classification = Classification(
                id=item.id or uuid.uuid4(),
                tree_id=tree.id,
                encrypted_data=item.encrypted_data,
            )
            db.add(classification)
            resp.classifications_created.append(classification.id)

        await db.flush()

        # Add event-person junction rows after events are flushed
        for item, event_id in zip(body.events_create, resp.events_created):
            for pid in item.person_ids:
                db.add(EventPerson(event_id=event_id, person_id=pid))

        # Add classification-person junction rows
        for item, cls_id in zip(body.classifications_create, resp.classifications_created):
            for pid in item.person_ids:
                db.add(ClassificationPerson(classification_id=cls_id, person_id=pid))

        # Phase 3: Updates
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

        for item in body.relationships_update:
            result = await db.execute(
                select(Relationship).where(
                    Relationship.id == item.id, Relationship.tree_id == tree.id
                )
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

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        logger.exception("Unexpected error during tree sync (tree_id=%s)", tree.id)
        await db.rollback()
        raise

    return resp
