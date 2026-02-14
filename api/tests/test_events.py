"""Tests for trauma event CRUD endpoints."""

import uuid

import pytest


class TestCreateEvent:
    @pytest.mark.asyncio
    async def test_create_event(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [person["id"]], "encrypted_data": "event-blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "event-blob"
        assert data["person_ids"] == [person["id"]]

    @pytest.mark.asyncio
    async def test_create_event_empty_persons(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [], "encrypted_data": "blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["person_ids"] == []

    @pytest.mark.asyncio
    async def test_create_event_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [str(uuid.uuid4())], "encrypted_data": "blob"},
            headers=headers,
        )
        assert resp.status_code == 422


class TestListEvents:
    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/events", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_events(self, client, headers, tree, person):
        await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        resp = await client.get(f"/trees/{tree['id']}/events", headers=headers)
        assert len(resp.json()) == 1


class TestGetEvent:
    @pytest.mark.asyncio
    async def test_get_event(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        event_id = create.json()["id"]
        resp = await client.get(f"/trees/{tree['id']}/events/{event_id}", headers=headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/events/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


class TestUpdateEvent:
    @pytest.mark.asyncio
    async def test_update_encrypted_data(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [person["id"]], "encrypted_data": "old"},
            headers=headers,
        )
        event_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/events/{event_id}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    @pytest.mark.asyncio
    async def test_update_person_ids(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        event_id = create.json()["id"]

        # Create second person
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]

        resp = await client.put(
            f"/trees/{tree['id']}/events/{event_id}",
            json={"person_ids": [p2_id]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["person_ids"] == [p2_id]

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/events/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestDeleteEvent:
    @pytest.mark.asyncio
    async def test_delete_event(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/events",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        event_id = create.json()["id"]
        resp = await client.delete(f"/trees/{tree['id']}/events/{event_id}", headers=headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(f"/trees/{tree['id']}/events/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404
