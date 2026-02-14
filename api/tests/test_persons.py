"""Tests for person CRUD endpoints."""

import uuid

import pytest

from tests.conftest import auth_headers, create_user


class TestCreatePerson:
    @pytest.mark.asyncio
    async def test_create_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/persons",
            json={"encrypted_data": "person-blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "person-blob"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_person_wrong_tree(self, client, headers):
        resp = await client.post(
            f"/trees/{uuid.uuid4()}/persons",
            json={"encrypted_data": "blob"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestListPersons:
    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/persons", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_persons(self, client, headers, tree, person):
        resp = await client.get(f"/trees/{tree['id']}/persons", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestGetPerson:
    @pytest.mark.asyncio
    async def test_get_person(self, client, headers, tree, person):
        resp = await client.get(f"/trees/{tree['id']}/persons/{person['id']}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "encrypted-person-data"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/persons/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


class TestUpdatePerson:
    @pytest.mark.asyncio
    async def test_update_person(self, client, headers, tree, person):
        resp = await client.put(
            f"/trees/{tree['id']}/persons/{person['id']}",
            json={"encrypted_data": "updated"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "updated"

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/persons/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestDeletePerson:
    @pytest.mark.asyncio
    async def test_delete_person(self, client, headers, tree, person):
        resp = await client.delete(f"/trees/{tree['id']}/persons/{person['id']}", headers=headers)
        assert resp.status_code == 204

        resp = await client.get(f"/trees/{tree['id']}/persons/{person['id']}", headers=headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(f"/trees/{tree['id']}/persons/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


class TestOwnershipIsolation:
    @pytest.mark.asyncio
    async def test_cannot_access_other_users_persons(self, client, headers, tree, person, db_session):
        other = await create_user(db_session, email="other@example.com")
        other_headers = auth_headers(other.id)

        resp = await client.get(f"/trees/{tree['id']}/persons", headers=other_headers)
        assert resp.status_code == 404  # tree not found for this user
