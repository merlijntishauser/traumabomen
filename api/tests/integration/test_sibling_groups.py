"""Tests for sibling group CRUD endpoints."""

import uuid

import pytest

from tests.integration.conftest import auth_headers, create_user


class TestCreateSiblingGroup:
    @pytest.mark.asyncio
    async def test_create(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "sg-blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "sg-blob"
        assert data["person_ids"] == [person["id"]]

    @pytest.mark.asyncio
    async def test_create_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [str(uuid.uuid4())], "encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_duplicate_person_conflict(self, client, headers, tree, person):
        """A person already in one sibling group cannot be added to another."""
        resp1 = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "g1"},
            headers=headers,
        )
        assert resp1.status_code == 201

        resp2 = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "g2"},
            headers=headers,
        )
        assert resp2.status_code == 409


class TestListSiblingGroups:
    @pytest.mark.asyncio
    async def test_list(self, client, headers, tree, person):
        await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        resp = await client.get(f"/trees/{tree['id']}/sibling-groups", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetSiblingGroup:
    @pytest.mark.asyncio
    async def test_get(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        sg_id = create.json()["id"]
        resp = await client.get(f"/trees/{tree['id']}/sibling-groups/{sg_id}", headers=headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(
            f"/trees/{tree['id']}/sibling-groups/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


class TestUpdateSiblingGroup:
    @pytest.mark.asyncio
    async def test_update_encrypted_data(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "old"},
            headers=headers,
        )
        sg_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/sibling-groups/{sg_id}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    @pytest.mark.asyncio
    async def test_update_person_ids(self, client, headers, tree, person):
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]

        create = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        sg_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/sibling-groups/{sg_id}",
            json={"person_ids": [person["id"], p2_id]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert sorted(resp.json()["person_ids"]) == sorted([person["id"], p2_id])

    @pytest.mark.asyncio
    async def test_update_person_ids_conflict(self, client, headers, tree, person):
        """Moving a person into a group where they already belong to another triggers 409."""
        p2 = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "p2"},
            headers=headers,
        )
        p2_id = p2.json()["id"]

        # Group 1 has person
        await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "g1"},
            headers=headers,
        )
        # Group 2 has p2
        create2 = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [p2_id], "encrypted_data": "g2"},
            headers=headers,
        )
        sg2_id = create2.json()["id"]

        # Try to add person (already in group 1) to group 2
        resp = await client.put(
            f"/trees/{tree['id']}/sibling-groups/{sg2_id}",
            json={"person_ids": [p2_id, person["id"]]},
            headers=headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/sibling-groups/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestDeleteSiblingGroup:
    @pytest.mark.asyncio
    async def test_delete(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "x"},
            headers=headers,
        )
        sg_id = create.json()["id"]
        resp = await client.delete(f"/trees/{tree['id']}/sibling-groups/{sg_id}", headers=headers)
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(
            f"/trees/{tree['id']}/sibling-groups/{uuid.uuid4()}", headers=headers
        )
        assert resp.status_code == 404


class TestOwnershipIsolation:
    @pytest.mark.asyncio
    async def test_other_user_cannot_access(self, client, headers, tree, person, db_session):
        """User B should not be able to access user A's sibling groups."""
        create = await client.post(
            f"/trees/{tree['id']}/sibling-groups",
            json={"person_ids": [person["id"]], "encrypted_data": "secret"},
            headers=headers,
        )
        sg_id = create.json()["id"]

        other = await create_user(db_session, email="other@example.com")
        other_headers = auth_headers(other.id)

        resp = await client.get(
            f"/trees/{tree['id']}/sibling-groups/{sg_id}", headers=other_headers
        )
        assert resp.status_code == 404
