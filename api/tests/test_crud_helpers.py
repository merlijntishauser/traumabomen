"""Unit tests for the shared CRUD helper module.

Uses TraumaEvent / EventPerson as the concrete entity config, exercising
all helper functions through the real database (in-memory SQLite).
"""

import uuid

import pytest
from fastapi import HTTPException

from app.models.event import EventPerson, TraumaEvent
from app.models.person import Person
from app.models.tree import Tree
from app.models.user import User
from app.routers.crud_helpers import (
    EntityConfig,
    build_entity_response,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
    validate_persons_in_tree,
)
from app.schemas.tree import EventResponse

_config = EntityConfig(
    model=TraumaEvent,
    junction_model=EventPerson,
    junction_fk="event_id",
    response_schema=EventResponse,
    not_found_detail="Event not found",
)


async def _create_user(db) -> User:
    user = User(
        email="helper-test@example.com",
        hashed_password="hashed",
        encryption_salt="salt",
        email_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _create_tree(db) -> Tree:
    user = await _create_user(db)
    tree = Tree(user_id=user.id, encrypted_data="tree-blob")
    db.add(tree)
    await db.flush()
    return tree


async def _create_person(db, tree_id: uuid.UUID) -> Person:
    person = Person(tree_id=tree_id, encrypted_data="person-blob")
    db.add(person)
    await db.flush()
    return person


class TestValidatePersonsInTree:
    @pytest.mark.asyncio
    async def test_empty_list(self, db_session):
        """Empty person_ids should succeed without querying."""
        await validate_persons_in_tree([], uuid.uuid4(), db_session)

    @pytest.mark.asyncio
    async def test_all_valid(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        await validate_persons_in_tree([p.id], tree.id, db_session)

    @pytest.mark.asyncio
    async def test_some_missing(self, db_session):
        tree = await _create_tree(db_session)
        missing_id = uuid.uuid4()
        with pytest.raises(HTTPException) as exc_info:
            await validate_persons_in_tree([missing_id], tree.id, db_session)
        assert exc_info.value.status_code == 422
        assert str(missing_id) in exc_info.value.detail


class TestBuildEntityResponse:
    @pytest.mark.asyncio
    async def test_maps_fields(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        event = TraumaEvent(tree_id=tree.id, encrypted_data="blob")
        db_session.add(event)
        await db_session.flush()
        db_session.add(EventPerson(event_id=event.id, person_id=p.id))
        await db_session.commit()
        await db_session.refresh(event, ["person_links"])

        resp = build_entity_response(event, _config)
        assert resp.id == event.id
        assert resp.person_ids == [p.id]
        assert resp.encrypted_data == "blob"
        assert resp.created_at is not None
        assert resp.updated_at is not None


class TestCreateEntity:
    @pytest.mark.asyncio
    async def test_create(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        resp = await create_entity(_config, [p.id], "data", tree.id, db_session)
        assert resp.encrypted_data == "data"
        assert resp.person_ids == [p.id]
        assert resp.id is not None

    @pytest.mark.asyncio
    async def test_create_empty_persons(self, db_session):
        tree = await _create_tree(db_session)
        resp = await create_entity(_config, [], "data", tree.id, db_session)
        assert resp.person_ids == []

    @pytest.mark.asyncio
    async def test_create_invalid_person(self, db_session):
        tree = await _create_tree(db_session)
        with pytest.raises(HTTPException) as exc_info:
            await create_entity(_config, [uuid.uuid4()], "data", tree.id, db_session)
        assert exc_info.value.status_code == 422


class TestListEntities:
    @pytest.mark.asyncio
    async def test_list_empty(self, db_session):
        tree = await _create_tree(db_session)
        result = await list_entities(_config, tree.id, db_session)
        assert result == []

    @pytest.mark.asyncio
    async def test_list(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        await create_entity(_config, [p.id], "data", tree.id, db_session)
        result = await list_entities(_config, tree.id, db_session)
        assert len(result) == 1
        assert result[0].encrypted_data == "data"


class TestGetEntity:
    @pytest.mark.asyncio
    async def test_get(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        created = await create_entity(_config, [p.id], "data", tree.id, db_session)
        resp = await get_entity(_config, created.id, tree.id, db_session)
        assert resp.id == created.id
        assert resp.encrypted_data == "data"

    @pytest.mark.asyncio
    async def test_get_not_found(self, db_session):
        tree = await _create_tree(db_session)
        with pytest.raises(HTTPException) as exc_info:
            await get_entity(_config, uuid.uuid4(), tree.id, db_session)
        assert exc_info.value.status_code == 404


class TestUpdateEntity:
    @pytest.mark.asyncio
    async def test_update_encrypted_data(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        created = await create_entity(_config, [p.id], "old", tree.id, db_session)
        resp = await update_entity(_config, created.id, tree.id, "new", None, db_session)
        assert resp.encrypted_data == "new"
        assert resp.person_ids == [p.id]

    @pytest.mark.asyncio
    async def test_update_person_ids(self, db_session):
        tree = await _create_tree(db_session)
        p1 = await _create_person(db_session, tree.id)
        p2 = await _create_person(db_session, tree.id)
        created = await create_entity(_config, [p1.id], "data", tree.id, db_session)
        resp = await update_entity(_config, created.id, tree.id, None, [p2.id], db_session)
        assert resp.person_ids == [p2.id]
        assert resp.encrypted_data == "data"

    @pytest.mark.asyncio
    async def test_update_both(self, db_session):
        tree = await _create_tree(db_session)
        p1 = await _create_person(db_session, tree.id)
        p2 = await _create_person(db_session, tree.id)
        created = await create_entity(_config, [p1.id], "old", tree.id, db_session)
        resp = await update_entity(_config, created.id, tree.id, "new", [p2.id], db_session)
        assert resp.encrypted_data == "new"
        assert resp.person_ids == [p2.id]

    @pytest.mark.asyncio
    async def test_update_not_found(self, db_session):
        tree = await _create_tree(db_session)
        with pytest.raises(HTTPException) as exc_info:
            await update_entity(_config, uuid.uuid4(), tree.id, "x", None, db_session)
        assert exc_info.value.status_code == 404


class TestDeleteEntity:
    @pytest.mark.asyncio
    async def test_delete(self, db_session):
        tree = await _create_tree(db_session)
        p = await _create_person(db_session, tree.id)
        created = await create_entity(_config, [p.id], "data", tree.id, db_session)
        await delete_entity(_config, created.id, tree.id, db_session)
        with pytest.raises(HTTPException) as exc_info:
            await get_entity(_config, created.id, tree.id, db_session)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_not_found(self, db_session):
        tree = await _create_tree(db_session)
        with pytest.raises(HTTPException) as exc_info:
            await delete_entity(_config, uuid.uuid4(), tree.id, db_session)
        assert exc_info.value.status_code == 404
