"""Tests for tree CRUD endpoints."""

import uuid

import pytest

from tests.conftest import auth_headers, create_user


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
    async def test_create_second_tree_fails(self, client, headers, tree):
        resp = await client.post("/trees", json={"encrypted_data": "blob2"}, headers=headers)
        assert resp.status_code == 409

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
