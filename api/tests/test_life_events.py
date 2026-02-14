"""Tests for life event CRUD endpoints."""

import uuid

import pytest


class TestCreateLifeEvent:
    @pytest.mark.asyncio
    async def test_create(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "le-blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "le-blob"
        assert data["person_ids"] == [person["id"]]

    @pytest.mark.asyncio
    async def test_create_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [str(uuid.uuid4())], "encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 422


class TestListLifeEvents:
    @pytest.mark.asyncio
    async def test_list(self, client, headers, tree, person):
        await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        resp = await client.get(f"/trees/{tree['id']}/life-events", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetLifeEvent:
    @pytest.mark.asyncio
    async def test_get(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        le_id = create.json()["id"]
        resp = await client.get(f"/trees/{tree['id']}/life-events/{le_id}", headers=headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(
            f"/trees/{tree['id']}/life-events/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


class TestUpdateLifeEvent:
    @pytest.mark.asyncio
    async def test_update(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "old"},
            headers=headers,
        )
        le_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/life-events/{le_id}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    @pytest.mark.asyncio
    async def test_update_person_ids(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        le_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/life-events/{le_id}",
            json={"person_ids": []},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["person_ids"] == []


    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/life-events/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_person_ids_nonempty(self, client, headers, tree, person):
        """Update person_ids to a non-empty list to cover the junction row creation."""
        # Create second person
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]

        create = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        le_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/life-events/{le_id}",
            json={"person_ids": [p2_id]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["person_ids"] == [p2_id]


class TestDeleteLifeEvent:
    @pytest.mark.asyncio
    async def test_delete(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/life-events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        le_id = create.json()["id"]
        resp = await client.delete(f"/trees/{tree['id']}/life-events/{le_id}", headers=headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(
            f"/trees/{tree['id']}/life-events/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404
