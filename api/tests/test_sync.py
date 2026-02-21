"""Tests for bulk sync endpoint."""

import uuid

import pytest


class TestSyncCreate:
    @pytest.mark.asyncio
    async def test_create_persons(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"persons_create": [{"encrypted_data": "p1"}, {"encrypted_data": "p2"}]},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["persons_created"]) == 2

    @pytest.mark.asyncio
    async def test_create_with_custom_id(self, client, headers, tree):
        custom_id = str(uuid.uuid4())
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"persons_create": [{"id": custom_id, "encrypted_data": "p"}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["persons_created"][0] == custom_id

    @pytest.mark.asyncio
    async def test_create_persons_and_relationship(self, client, headers, tree):
        p1_id = str(uuid.uuid4())
        p2_id = str(uuid.uuid4())
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "persons_create": [
                    {"id": p1_id, "encrypted_data": "a"},
                    {"id": p2_id, "encrypted_data": "b"},
                ],
                "relationships_create": [
                    {
                        "source_person_id": p1_id,
                        "target_person_id": p2_id,
                        "encrypted_data": "rel",
                    }
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["persons_created"]) == 2
        assert len(data["relationships_created"]) == 1

    @pytest.mark.asyncio
    async def test_create_persons_and_events(self, client, headers, tree):
        p_id = str(uuid.uuid4())
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "persons_create": [{"id": p_id, "encrypted_data": "p"}],
                "events_create": [{"person_ids": [p_id], "encrypted_data": "ev"}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()["events_created"]) == 1

    @pytest.mark.asyncio
    async def test_create_relationship_invalid_person(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "relationships_create": [
                    {
                        "source_person_id": person["id"],
                        "target_person_id": str(uuid.uuid4()),
                        "encrypted_data": "x",
                    }
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 422


class TestSyncDeleteRelationships:
    @pytest.mark.asyncio
    async def test_delete_relationship(self, client, headers, tree):
        p1_id = str(uuid.uuid4())
        p2_id = str(uuid.uuid4())
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "persons_create": [
                    {"id": p1_id, "encrypted_data": "a"},
                    {"id": p2_id, "encrypted_data": "b"},
                ],
                "relationships_create": [
                    {
                        "source_person_id": p1_id,
                        "target_person_id": p2_id,
                        "encrypted_data": "rel",
                    }
                ],
            },
            headers=headers,
        )
        rel_id = create.json()["relationships_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"relationships_delete": [{"id": rel_id}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["relationships_deleted"] == 1

    @pytest.mark.asyncio
    async def test_delete_event(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_create": [{"person_ids": [person["id"]], "encrypted_data": "ev"}]},
            headers=headers,
        )
        ev_id = create.json()["events_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_delete": [{"id": ev_id}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["events_deleted"] == 1


class TestSyncUpdateRelationships:
    @pytest.mark.asyncio
    async def test_update_relationship(self, client, headers, tree):
        p1_id = str(uuid.uuid4())
        p2_id = str(uuid.uuid4())
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "persons_create": [
                    {"id": p1_id, "encrypted_data": "a"},
                    {"id": p2_id, "encrypted_data": "b"},
                ],
                "relationships_create": [
                    {
                        "source_person_id": p1_id,
                        "target_person_id": p2_id,
                        "encrypted_data": "old",
                    }
                ],
            },
            headers=headers,
        )
        rel_id = create.json()["relationships_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "relationships_update": [
                    {"id": rel_id, "encrypted_data": "new"},
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["relationships_updated"] == 1

    @pytest.mark.asyncio
    async def test_update_relationship_person_ids(self, client, headers, tree):
        """Update source and target person ids on a relationship via sync."""
        p1_id = str(uuid.uuid4())
        p2_id = str(uuid.uuid4())
        p3_id = str(uuid.uuid4())
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "persons_create": [
                    {"id": p1_id, "encrypted_data": "a"},
                    {"id": p2_id, "encrypted_data": "b"},
                    {"id": p3_id, "encrypted_data": "c"},
                ],
                "relationships_create": [
                    {
                        "source_person_id": p1_id,
                        "target_person_id": p2_id,
                        "encrypted_data": "rel",
                    }
                ],
            },
            headers=headers,
        )
        rel_id = create.json()["relationships_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "relationships_update": [
                    {"id": rel_id, "source_person_id": p3_id, "target_person_id": p3_id},
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["relationships_updated"] == 1

    @pytest.mark.asyncio
    async def test_update_nonexistent_relationship(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "relationships_update": [
                    {"id": str(uuid.uuid4()), "encrypted_data": "x"},
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_event(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_create": [{"person_ids": [person["id"]], "encrypted_data": "old"}]},
            headers=headers,
        )
        ev_id = create.json()["events_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_update": [{"id": ev_id, "encrypted_data": "new"}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["events_updated"] == 1

    @pytest.mark.asyncio
    async def test_update_event_person_ids(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_create": [{"person_ids": [person["id"]], "encrypted_data": "ev"}]},
            headers=headers,
        )
        ev_id = create.json()["events_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_update": [{"id": ev_id, "person_ids": []}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["events_updated"] == 1

    @pytest.mark.asyncio
    async def test_update_nonexistent_event(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"events_update": [{"id": str(uuid.uuid4()), "encrypted_data": "x"}]},
            headers=headers,
        )
        assert resp.status_code == 404


class TestSyncUpdate:
    @pytest.mark.asyncio
    async def test_update_person(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"persons_update": [{"id": person["id"], "encrypted_data": "updated"}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["persons_updated"] == 1

        # Verify the update
        get = await client.get(f"/trees/{tree['id']}/persons/{person['id']}", headers=headers)
        assert get.json()["encrypted_data"] == "updated"

    @pytest.mark.asyncio
    async def test_update_nonexistent_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"persons_update": [{"id": str(uuid.uuid4()), "encrypted_data": "x"}]},
            headers=headers,
        )
        assert resp.status_code == 404


class TestSyncDelete:
    @pytest.mark.asyncio
    async def test_delete_person(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"persons_delete": [{"id": person["id"]}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["persons_deleted"] == 1

    @pytest.mark.asyncio
    async def test_delete_nonexistent_silently_skipped(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"persons_delete": [{"id": str(uuid.uuid4())}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["persons_deleted"] == 0


class TestSyncEmpty:
    @pytest.mark.asyncio
    async def test_empty_sync(self, client, headers, tree):
        resp = await client.post(f"/trees/{tree['id']}/sync", json={}, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["persons_created"] == []
        assert data["persons_updated"] == 0
        assert data["persons_deleted"] == 0


class TestSyncClassifications:
    @pytest.mark.asyncio
    async def test_create_classification(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_create": [{"person_ids": [person["id"]], "encrypted_data": "cls"}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()["classifications_created"]) == 1

    @pytest.mark.asyncio
    async def test_delete_classification(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_create": [{"person_ids": [person["id"]], "encrypted_data": "cls"}],
            },
            headers=headers,
        )
        cls_id = create.json()["classifications_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"classifications_delete": [{"id": cls_id}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["classifications_deleted"] == 1

    @pytest.mark.asyncio
    async def test_update_classification(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_create": [{"person_ids": [person["id"]], "encrypted_data": "old"}],
            },
            headers=headers,
        )
        cls_id = create.json()["classifications_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_update": [{"id": cls_id, "encrypted_data": "new"}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["classifications_updated"] == 1

    @pytest.mark.asyncio
    async def test_update_classification_person_ids(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_create": [{"person_ids": [person["id"]], "encrypted_data": "cls"}],
            },
            headers=headers,
        )
        cls_id = create.json()["classifications_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_update": [{"id": cls_id, "person_ids": []}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["classifications_updated"] == 1

    @pytest.mark.asyncio
    async def test_update_nonexistent_classification(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_update": [{"id": str(uuid.uuid4()), "encrypted_data": "x"}],
            },
            headers=headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_create_classification_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "classifications_create": [
                    {"person_ids": [str(uuid.uuid4())], "encrypted_data": "cls"}
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 422


class TestSyncTurningPoints:
    @pytest.mark.asyncio
    async def test_create_turning_point(self, client, headers, tree, person):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "turning_points_create": [{"person_ids": [person["id"]], "encrypted_data": "tp1"}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()["turning_points_created"]) == 1

    @pytest.mark.asyncio
    async def test_update_turning_point(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "turning_points_create": [{"person_ids": [person["id"]], "encrypted_data": "old"}],
            },
            headers=headers,
        )
        tp_id = create.json()["turning_points_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "turning_points_update": [{"id": tp_id, "encrypted_data": "new"}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["turning_points_updated"] == 1

    @pytest.mark.asyncio
    async def test_delete_turning_point(self, client, headers, tree, person):
        create = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "turning_points_create": [{"person_ids": [person["id"]], "encrypted_data": "tp"}],
            },
            headers=headers,
        )
        tp_id = create.json()["turning_points_created"][0]

        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={"turning_points_delete": [{"id": tp_id}]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["turning_points_deleted"] == 1

    @pytest.mark.asyncio
    async def test_create_turning_point_invalid_person(self, client, headers, tree):
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "turning_points_create": [
                    {"person_ids": [str(uuid.uuid4())], "encrypted_data": "tp"}
                ],
            },
            headers=headers,
        )
        assert resp.status_code == 422


class TestSyncFullCycle:
    @pytest.mark.asyncio
    async def test_create_update_delete_in_one_call(self, client, headers, tree, person):
        """Create a new person, update existing, and delete existing in one sync."""
        new_id = str(uuid.uuid4())
        resp = await client.post(
            f"/trees/{tree['id']}/sync",
            json={
                "persons_create": [{"id": new_id, "encrypted_data": "new-person"}],
                "persons_update": [{"id": person["id"], "encrypted_data": "modified"}],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["persons_created"]) == 1
        assert data["persons_updated"] == 1
