"""Tests for tree CRUD endpoints."""

import uuid

import pytest

from tests.integration.conftest import auth_headers, create_user


class TestCreateTree:
    @pytest.mark.asyncio
    async def test_create_tree(self, client, headers):
        resp = await client.post("/trees", json={"encrypted_data": "blob"}, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "blob"
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_second_tree(self, client, headers, tree):
        resp = await client.post("/trees", json={"encrypted_data": "blob2"}, headers=headers)
        assert resp.status_code == 201
        assert resp.json()["id"] != tree["id"]

    @pytest.mark.asyncio
    async def test_create_tree_unauthenticated(self, client):
        resp = await client.post("/trees", json={"encrypted_data": "blob"})
        assert resp.status_code == 401


class TestListTrees:
    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers):
        resp = await client.get("/trees", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_with_tree(self, client, headers, tree):
        resp = await client.get("/trees", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == tree["id"]

    @pytest.mark.asyncio
    async def test_list_includes_structural_counts(self, client, headers, tree):
        # Empty tree: all counts zero
        resp = await client.get("/trees", headers=headers)
        entry = resp.json()[0]
        assert entry["person_count"] == 0
        assert entry["moment_count"] == 0
        assert entry["pattern_count"] == 0

        # One person, one trauma event, one life event, one pattern
        person = await client.post(
            f"/trees/{tree['id']}/persons",
            headers=headers,
            json={"encrypted_data": "encrypted-person"},
        )
        person_id = person.json()["id"]
        await client.post(
            f"/trees/{tree['id']}/events",
            headers=headers,
            json={"encrypted_data": "encrypted-event", "person_ids": [person_id]},
        )
        await client.post(
            f"/trees/{tree['id']}/life-events",
            headers=headers,
            json={"encrypted_data": "encrypted-life-event", "person_ids": [person_id]},
        )
        await client.post(
            f"/trees/{tree['id']}/patterns",
            headers=headers,
            json={"encrypted_data": "encrypted-pattern", "person_ids": [person_id]},
        )

        resp = await client.get("/trees", headers=headers)
        entry = resp.json()[0]
        assert entry["person_count"] == 1
        assert entry["moment_count"] == 2
        assert entry["pattern_count"] == 1

    @pytest.mark.asyncio
    async def test_list_isolation(self, client, headers, tree, db_session):
        """Other user's trees should not be visible."""
        other = await create_user(db_session, email="other@example.com")
        other_headers = auth_headers(other.id)
        resp = await client.get("/trees", headers=other_headers)
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetTree:
    @pytest.mark.asyncio
    async def test_get_tree(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "encrypted-tree-data"

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client, headers):
        resp = await client.get(f"/trees/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_other_users_tree(self, client, tree, db_session):
        other = await create_user(db_session, email="other@example.com")
        resp = await client.get(f"/trees/{tree['id']}", headers=auth_headers(other.id))
        assert resp.status_code == 404


class TestUpdateTree:
    @pytest.mark.asyncio
    async def test_update_tree(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}",
            json={"encrypted_data": "updated-blob"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "updated-blob"

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers):
        resp = await client.put(
            f"/trees/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestDeleteTree:
    @pytest.mark.asyncio
    async def test_delete_tree(self, client, headers, tree):
        resp = await client.delete(f"/trees/{tree['id']}", headers=headers)
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get(f"/trees/{tree['id']}", headers=headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers):
        resp = await client.delete(f"/trees/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404
