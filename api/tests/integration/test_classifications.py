"""Tests for classification CRUD endpoints."""

import uuid

import pytest


@pytest.fixture
async def classification(client, headers, tree, person):
    """Create and return a classification linked to the default person."""
    resp = await client.post(
        f"/trees/{tree['id']}/classifications",
        json={"person_ids": [person["id"]], "encrypted_data": "cls-data"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


class TestCreateClassification:
    @pytest.mark.asyncio
    async def test_create(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/classifications",
            json={"person_ids": [person["id"]], "encrypted_data": "cls"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "cls"
        assert person["id"] in data["person_ids"]

    @pytest.mark.asyncio
    async def test_create_no_persons(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/classifications",
            json={"person_ids": [], "encrypted_data": "cls"},
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["person_ids"] == []

    @pytest.mark.asyncio
    async def test_create_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/classifications",
            json={"person_ids": [str(uuid.uuid4())], "encrypted_data": "cls"},
            headers=headers,
        )
        assert resp.status_code == 422


class TestListClassifications:
    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/classifications", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_with_data(self, client, headers, tree, classification):
        resp = await client.get(f"/trees/{tree['id']}/classifications", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetClassification:
    @pytest.mark.asyncio
    async def test_get(self, client, headers, tree, classification):
        cls_id = classification["id"]
        resp = await client.get(f"/trees/{tree['id']}/classifications/{cls_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "cls-data"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(
            f"/trees/{tree['id']}/classifications/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


class TestUpdateClassification:
    @pytest.mark.asyncio
    async def test_update_encrypted_data(self, client, headers, tree, classification):
        cls_id = classification["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/classifications/{cls_id}",
            json={"encrypted_data": "updated"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "updated"

    @pytest.mark.asyncio
    async def test_update_person_ids(self, client, headers, tree, person, classification):
        cls_id = classification["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/classifications/{cls_id}",
            json={"person_ids": []},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["person_ids"] == []

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/classifications/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_invalid_person(self, client, headers, tree, classification):
        cls_id = classification["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/classifications/{cls_id}",
            json={"person_ids": [str(uuid.uuid4())]},
            headers=headers,
        )
        assert resp.status_code == 422


class TestDeleteClassification:
    @pytest.mark.asyncio
    async def test_delete(self, client, headers, tree, classification):
        cls_id = classification["id"]
        resp = await client.delete(f"/trees/{tree['id']}/classifications/{cls_id}", headers=headers)
        assert resp.status_code == 204

        # Verify it's gone
        get = await client.get(f"/trees/{tree['id']}/classifications/{cls_id}", headers=headers)
        assert get.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(
            f"/trees/{tree['id']}/classifications/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404
