"""Tests for journal entry CRUD endpoints."""

import uuid

import pytest

from tests.conftest import auth_headers, create_user


class TestCreateJournalEntry:
    @pytest.mark.asyncio
    async def test_create(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/journal",
            json={"encrypted_data": "journal-blob"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["encrypted_data"] == "journal-blob"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data


class TestListJournalEntries:
    @pytest.mark.asyncio
    async def test_list_returns_all_entries(self, client, headers, tree):
        await client.post(
            f"/trees/{tree['id']}/journal",
            json={"encrypted_data": "first"},
            headers=headers,
        )
        await client.post(
            f"/trees/{tree['id']}/journal",
            json={"encrypted_data": "second"},
            headers=headers,
        )
        resp = await client.get(f"/trees/{tree['id']}/journal", headers=headers)
        assert resp.status_code == 200
        entries = resp.json()
        assert len(entries) == 2
        contents = {e["encrypted_data"] for e in entries}
        assert contents == {"first", "second"}

    @pytest.mark.asyncio
    async def test_list_empty(self, client, headers, tree):
        resp = await client.get(f"/trees/{tree['id']}/journal", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []


class TestUpdateJournalEntry:
    @pytest.mark.asyncio
    async def test_update(self, client, headers, tree):
        create = await client.post(
            f"/trees/{tree['id']}/journal",
            json={"encrypted_data": "old"},
            headers=headers,
        )
        entry_id = create.json()["id"]
        resp = await client.put(
            f"/trees/{tree['id']}/journal/{entry_id}",
            json={"encrypted_data": "new"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["encrypted_data"] == "new"

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, headers, tree):
        resp = await client.put(
            f"/trees/{tree['id']}/journal/{uuid.uuid4()}",
            json={"encrypted_data": "x"},
            headers=headers,
        )
        assert resp.status_code == 404


class TestDeleteJournalEntry:
    @pytest.mark.asyncio
    async def test_delete(self, client, headers, tree):
        create = await client.post(
            f"/trees/{tree['id']}/journal",
            json={"encrypted_data": "to-delete"},
            headers=headers,
        )
        entry_id = create.json()["id"]
        resp = await client.delete(f"/trees/{tree['id']}/journal/{entry_id}", headers=headers)
        assert resp.status_code == 204

        # Verify it's gone
        list_resp = await client.get(f"/trees/{tree['id']}/journal", headers=headers)
        assert len(list_resp.json()) == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, headers, tree):
        resp = await client.delete(f"/trees/{tree['id']}/journal/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404


class TestOwnershipIsolation:
    @pytest.mark.asyncio
    async def test_other_user_cannot_access(self, client, headers, tree, db_session):
        """User B should not be able to access user A's journal entries."""
        create = await client.post(
            f"/trees/{tree['id']}/journal",
            json={"encrypted_data": "secret-journal"},
            headers=headers,
        )
        entry_id = create.json()["id"]

        other = await create_user(db_session, email="other@example.com")
        other_headers = auth_headers(other.id)

        # List should return 404 (tree not owned)
        resp = await client.get(f"/trees/{tree['id']}/journal", headers=other_headers)
        assert resp.status_code == 404

        # Update should return 404
        resp = await client.put(
            f"/trees/{tree['id']}/journal/{entry_id}",
            json={"encrypted_data": "hacked"},
            headers=other_headers,
        )
        assert resp.status_code == 404

        # Delete should return 404
        resp = await client.delete(f"/trees/{tree['id']}/journal/{entry_id}", headers=other_headers)
        assert resp.status_code == 404
