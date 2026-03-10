"""Tests for pattern CRUD endpoints."""

import uuid

import pytest


class TestCreatePattern:
    @pytest.mark.asyncio
    async def test_create_pattern(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "pattern-blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "pattern-blob"
        assert data["person_ids"] == [person["id"]]

    @pytest.mark.asyncio
    async def test_create_pattern_empty_persons(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [], "encrypted_data": "blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["person_ids"] == []

    @pytest.mark.asyncio
    async def test_create_pattern_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [str(uuid.uuid4())], "encrypted_data": "blob"},
            headers=headers,
        )
        assert resp.status_code == 422


class TestListPatterns:
    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/patterns", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_patterns(self, client, headers, tree, person):
        await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        resp = await client.get(f"/trees/{tree['id']}/patterns", headers=headers)
        assert len(resp.json()) == 1


class TestGetPattern:
    @pytest.mark.asyncio
    async def test_get_pattern(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        pattern_id = create.json()["id"]
        resp = await client.get(f"/trees/{tree['id']}/patterns/{pattern_id}", headers=headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/patterns/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


class TestUpdatePattern:
    @pytest.mark.asyncio
    async def test_update_encrypted_data(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "old"},
            headers=headers,
        )
        pattern_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/patterns/{pattern_id}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    @pytest.mark.asyncio
    async def test_update_person_ids(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        pattern_id = create.json()["id"]

        # Create second person
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]

        resp = await client.put(
            f"/trees/{tree['id']}/patterns/{pattern_id}",
            json={"person_ids": [p2_id]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["person_ids"] == [p2_id]

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/patterns/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestDeletePattern:
    @pytest.mark.asyncio
    async def test_delete_pattern(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        pattern_id = create.json()["id"]
        resp = await client.delete(f"/trees/{tree['id']}/patterns/{pattern_id}", headers=headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(f"/trees/{tree['id']}/patterns/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


class TestSyncPatterns:
    @pytest.mark.asyncio
    async def test_sync_create_pattern(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "patterns_create": [{"person_ids": [person["id"]], "encrypted_data": "sync-blob"}]
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["patterns_created"]) == 1

        # Verify it was actually created
        list_resp = await client.get(f"/trees/{tree['id']}/patterns", headers=headers)
        assert len(list_resp.json()) == 1
        assert list_resp.json()[0]["encrypted_data"] == "sync-blob"

    @pytest.mark.asyncio
    async def test_sync_update_pattern(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "old"},
            headers=headers,
        )
        pattern_id = create.json()["id"]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"patterns_update": [{"id": pattern_id, "encrypted_data": "updated"}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["patterns_updated"] == 1

    @pytest.mark.asyncio
    async def test_sync_delete_pattern(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/patterns",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        pattern_id = create.json()["id"]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"patterns_delete": [{"id": pattern_id}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["patterns_deleted"] == 1

        # Verify it was deleted
        list_resp = await client.get(f"/trees/{tree['id']}/patterns", headers=headers)
        assert len(list_resp.json()) == 0
