"""Tests for key ring and migration endpoints."""

import pytest

from tests.conftest import auth_headers, create_user


class TestGetKeyRing:
    @pytest.mark.asyncio
    async def test_returns_404_when_no_key_ring(self, client, user, headers):
        resp = await client.get("/auth/key-ring", headers=headers)
        assert resp.status_code == 404
        assert resp.json()["detail"] == "No key ring"

    @pytest.mark.asyncio
    async def test_returns_key_ring_after_put(self, client, user, headers):
        await client.put(
            "/auth/key-ring",
            json={"encrypted_key_ring": "encrypted-ring-blob"},
            headers=headers,
        )
        resp = await client.get("/auth/key-ring", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["encrypted_key_ring"] == "encrypted-ring-blob"

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client):
        resp = await client.get("/auth/key-ring")
        assert resp.status_code == 401


class TestUpdateKeyRing:
    @pytest.mark.asyncio
    async def test_stores_key_ring(self, client, user, headers):
        resp = await client.put(
            "/auth/key-ring",
            json={"encrypted_key_ring": "new-ring-data"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Key ring updated"

    @pytest.mark.asyncio
    async def test_overwrites_existing_key_ring(self, client, user, headers):
        await client.put(
            "/auth/key-ring",
            json={"encrypted_key_ring": "first"},
            headers=headers,
        )
        await client.put(
            "/auth/key-ring",
            json={"encrypted_key_ring": "second"},
            headers=headers,
        )
        resp = await client.get("/auth/key-ring", headers=headers)
        assert resp.json()["encrypted_key_ring"] == "second"

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client):
        resp = await client.put("/auth/key-ring", json={"encrypted_key_ring": "data"})
        assert resp.status_code == 401


class TestMigrateKeys:
    @pytest.mark.asyncio
    async def test_migrates_tree_and_entities(self, client, user, headers, tree, person):
        tree_id = tree["id"]
        person_id = person["id"]

        resp = await client.post(
            "/auth/migrate-keys",
            json={
                "encrypted_key_ring": "migrated-ring",
                "trees": [
                    {
                        "tree_id": tree_id,
                        "encrypted_data": "re-encrypted-tree",
                        "persons": [{"id": person_id, "encrypted_data": "re-encrypted-person"}],
                        "relationships": [],
                        "events": [],
                        "life_events": [],
                        "turning_points": [],
                        "classifications": [],
                        "patterns": [],
                        "journal_entries": [],
                    }
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Migration complete"

        # Verify key ring was stored
        ring_resp = await client.get("/auth/key-ring", headers=headers)
        assert ring_resp.json()["encrypted_key_ring"] == "migrated-ring"

        # Verify tree data was re-encrypted
        tree_resp = await client.get(f"/trees/{tree_id}", headers=headers)
        assert tree_resp.json()["encrypted_data"] == "re-encrypted-tree"

        # Verify person data was re-encrypted
        person_resp = await client.get(f"/trees/{tree_id}/persons/{person_id}", headers=headers)
        assert person_resp.json()["encrypted_data"] == "re-encrypted-person"

    @pytest.mark.asyncio
    async def test_rejects_unowned_tree(self, client, db_session, user, headers, tree):
        other_user = await create_user(db_session, email="other@example.com")
        other_headers = auth_headers(other_user.id)
        other_tree_resp = await client.post(
            "/trees",
            json={"encrypted_data": "other-tree"},
            headers=other_headers,
        )
        other_tree_id = other_tree_resp.json()["id"]

        resp = await client.post(
            "/auth/migrate-keys",
            json={
                "encrypted_key_ring": "ring",
                "trees": [
                    {
                        "tree_id": other_tree_id,
                        "encrypted_data": "stolen",
                        "persons": [],
                        "relationships": [],
                        "events": [],
                        "life_events": [],
                        "turning_points": [],
                        "classifications": [],
                        "patterns": [],
                        "journal_entries": [],
                    }
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_rejects_already_migrated(self, client, user, headers, tree):
        # First migration
        await client.post(
            "/auth/migrate-keys",
            json={
                "encrypted_key_ring": "ring-v1",
                "trees": [
                    {
                        "tree_id": tree["id"],
                        "encrypted_data": "re-encrypted",
                        "persons": [],
                        "relationships": [],
                        "events": [],
                        "life_events": [],
                        "turning_points": [],
                        "classifications": [],
                        "patterns": [],
                        "journal_entries": [],
                    }
                ],
            },
            headers=headers,
        )

        # Second attempt should fail
        resp = await client.post(
            "/auth/migrate-keys",
            json={
                "encrypted_key_ring": "ring-v2",
                "trees": [
                    {
                        "tree_id": tree["id"],
                        "encrypted_data": "again",
                        "persons": [],
                        "relationships": [],
                        "events": [],
                        "life_events": [],
                        "turning_points": [],
                        "classifications": [],
                        "patterns": [],
                        "journal_entries": [],
                    }
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_migrates_empty_tree_list(self, client, user, headers):
        """User with no trees can still migrate (just stores the key ring)."""
        resp = await client.post(
            "/auth/migrate-keys",
            json={"encrypted_key_ring": "empty-ring", "trees": []},
            headers=headers,
        )
        assert resp.status_code == 200

        ring_resp = await client.get("/auth/key-ring", headers=headers)
        assert ring_resp.json()["encrypted_key_ring"] == "empty-ring"

    @pytest.mark.asyncio
    async def test_rejects_entity_from_another_tree(self, client, user, headers, tree, person):
        """Entity IDs that don't belong to the claimed tree are rejected."""
        # Create a second tree
        tree2_resp = await client.post(
            "/trees", json={"encrypted_data": "tree2-data"}, headers=headers
        )
        tree2_id = tree2_resp.json()["id"]

        # person belongs to the first tree; try to migrate it under tree2
        resp = await client.post(
            "/auth/migrate-keys",
            json={
                "encrypted_key_ring": "ring",
                "trees": [
                    {
                        "tree_id": tree["id"],
                        "encrypted_data": "re-encrypted-tree1",
                        "persons": [],
                        "relationships": [],
                        "events": [],
                        "life_events": [],
                        "turning_points": [],
                        "classifications": [],
                        "patterns": [],
                        "journal_entries": [],
                    },
                    {
                        "tree_id": tree2_id,
                        "encrypted_data": "re-encrypted-tree2",
                        "persons": [{"id": person["id"], "encrypted_data": "hijacked"}],
                        "relationships": [],
                        "events": [],
                        "life_events": [],
                        "turning_points": [],
                        "classifications": [],
                        "patterns": [],
                        "journal_entries": [],
                    },
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client):
        resp = await client.post(
            "/auth/migrate-keys",
            json={"encrypted_key_ring": "ring", "trees": []},
        )
        assert resp.status_code == 401
