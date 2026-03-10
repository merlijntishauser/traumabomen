"""Tests for relationship CRUD endpoints."""

import uuid

import pytest


@pytest.fixture
async def two_persons(client, headers, tree):
    """Create two persons in the tree."""
    r1 = await client.post(
        f"/trees/{tree['id']}/persons",
        json={"encrypted_data": "person-a"},
        headers=headers,
    )
    r2 = await client.post(
        f"/trees/{tree['id']}/persons",
        json={"encrypted_data": "person-b"},
        headers=headers,
    )
    return r1.json(), r2.json()


class TestCreateRelationship:
    @pytest.mark.asyncio
    async def test_create_relationship(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        resp = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "rel-data",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["source_person_id"] == p1["id"]
        assert data["target_person_id"] == p2["id"]
        assert data["encrypted_data"] == "rel-data"

    @pytest.mark.asyncio
    async def test_create_with_invalid_person(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": person["id"],
                "target_person_id": str(uuid.uuid4()),
                "encrypted_data": "x",
            },
            headers=headers,
        )
        assert resp.status_code == 422


class TestListRelationships:
    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/relationships", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_relationships(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "x",
            },
            headers=headers,
        )
        resp = await client.get(f"/trees/{tree['id']}/relationships", headers=headers)
        assert len(resp.json()) == 1


class TestGetRelationship:
    @pytest.mark.asyncio
    async def test_get_relationship(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        create = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "x",
            },
            headers=headers,
        )
        rel_id = create.json()["id"]
        resp = await client.get(f"/trees/{tree['id']}/relationships/{rel_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == rel_id

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(
            f"/trees/{tree['id']}/relationships/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


class TestUpdateRelationship:
    @pytest.mark.asyncio
    async def test_update_encrypted_data(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        create = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "old",
            },
            headers=headers,
        )
        rel_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/relationships/{rel_id}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    @pytest.mark.asyncio
    async def test_update_source_person(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        create = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "x",
            },
            headers=headers,
        )
        rel_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/relationships/{rel_id}",
            json={"source_person_id": p2["id"]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["source_person_id"] == p2["id"]

    @pytest.mark.asyncio
    async def test_update_with_invalid_person(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        create = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "x",
            },
            headers=headers,
        )
        rel_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/relationships/{rel_id}",
            json={"source_person_id": str(uuid.uuid4())},
            headers=headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/relationships/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_target_person(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        create = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "x",
            },
            headers=headers,
        )
        rel_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/relationships/{rel_id}",
            json={"target_person_id": p1["id"]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["target_person_id"] == p1["id"]


class TestDeleteRelationship:
    @pytest.mark.asyncio
    async def test_delete_relationship(self, client, headers, tree, two_persons):
        p1, p2 = two_persons
        create = await client.post(
            f"/trees/{tree['id']}/relationships",
            json={
                "source_person_id": p1["id"],
                "target_person_id": p2["id"],
                "encrypted_data": "x",
            },
            headers=headers,
        )
        rel_id = create.json()["id"]
        resp = await client.delete(f"/trees/{tree['id']}/relationships/{rel_id}", headers=headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(
            f"/trees/{tree['id']}/relationships/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404
