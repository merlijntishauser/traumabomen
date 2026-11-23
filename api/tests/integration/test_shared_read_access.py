"""Read access for share recipients: GET routes only, everything else owner-only."""

import uuid

import pytest
from fastapi.routing import APIRoute

from app.main import app
from app.models.tree_share import TreeShare
from tests.integration.conftest import auth_headers, create_user

READABLE = [
    "persons",
    "relationships",
    "events",
    "life-events",
    "classifications",
    "patterns",
    "turning-points",
    "sibling-groups",
]


@pytest.fixture
async def recipient(db_session):
    return await create_user(db_session, email="recipient@example.com")


@pytest.fixture
def recipient_headers(recipient):
    return auth_headers(recipient.id)


@pytest.fixture
def shared_with(db_session, user, tree):
    """Insert a share of the default tree for a recipient with the given status."""

    async def _share(recipient, status="active"):
        db_session.add(
            TreeShare(
                tree_id=uuid.UUID(tree["id"]),
                owner_id=user.id,
                recipient_email=recipient.email,
                recipient_id=recipient.id,
                encrypted_tree_key="wrapped",
                status=status,
            )
        )
        await db_session.commit()

    return _share


async def _create_entity(client, headers, tree, person, path):
    body: dict = {"encrypted_data": "blob"}
    if path == "relationships":
        other = await client.post(
            f"/trees/{tree['id']}/persons", json={"encrypted_data": "p2"}, headers=headers
        )
        body["source_person_id"] = person["id"]
        body["target_person_id"] = other.json()["id"]
    elif path != "persons":
        body["person_ids"] = [person["id"]]
    resp = await client.post(f"/trees/{tree['id']}/{path}", json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_viewer_can_get_tree(client, tree, shared_with, recipient, recipient_headers):
    await shared_with(recipient)
    resp = await client.get(f"/trees/{tree['id']}", headers=recipient_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == tree["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("path", READABLE)
async def test_viewer_can_get_each_readable_endpoint(
    client, headers, tree, person, shared_with, recipient, recipient_headers, path
):
    created = await _create_entity(client, headers, tree, person, path)
    await shared_with(recipient)

    listing = await client.get(f"/trees/{tree['id']}/{path}", headers=recipient_headers)
    assert listing.status_code == 200
    assert created["id"] in [e["id"] for e in listing.json()]

    single = await client.get(
        f"/trees/{tree['id']}/{path}/{created['id']}", headers=recipient_headers
    )
    assert single.status_code == 200
    assert single.json()["id"] == created["id"]


def _write_routes() -> list[tuple[str, str]]:
    routes = []
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/trees/{tree_id}"):
            continue
        for method in route.methods - {"GET", "HEAD", "OPTIONS"}:
            routes.append((method, route.path))
    return sorted(routes)


def test_write_route_enumeration_covers_known_routes():
    routes = _write_routes()
    paths = {path for _, path in routes}
    assert ("PUT", "/trees/{tree_id}") in routes
    assert ("DELETE", "/trees/{tree_id}") in routes
    assert "/trees/{tree_id}/sync" in paths
    assert "/trees/{tree_id}/journal" in paths
    assert "/trees/{tree_id}/journal/{entry_id}" in paths
    for prefix in READABLE:
        assert f"/trees/{{tree_id}}/{prefix}" in paths


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), _write_routes())
async def test_viewer_cannot_write_each_endpoint(
    client, tree, shared_with, recipient, recipient_headers, method, path
):
    await shared_with(recipient)
    url = path.replace("{tree_id}", tree["id"])
    for param in ("entity_id", "person_id", "relationship_id", "entry_id"):
        url = url.replace(f"{{{param}}}", str(uuid.uuid4()))
    assert "{" not in url
    resp = await client.request(
        method, url, json={"encrypted_data": "x"}, headers=recipient_headers
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Tree not found"


@pytest.mark.asyncio
async def test_viewer_journal_404(client, tree, shared_with, recipient, recipient_headers):
    await shared_with(recipient)
    resp = await client.get(f"/trees/{tree['id']}/journal", headers=recipient_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pending_share_grants_no_access(
    client, tree, person, shared_with, recipient, recipient_headers
):
    await shared_with(recipient, status="pending")
    for path in ("", "/persons", f"/persons/{person['id']}", "/events"):
        resp = await client.get(f"/trees/{tree['id']}{path}", headers=recipient_headers)
        assert resp.status_code == 404, path


@pytest.mark.asyncio
async def test_unrelated_user_404(client, db_session, tree, person):
    stranger = await create_user(db_session, email="stranger@example.com")
    resp = await client.get(f"/trees/{tree['id']}/persons", headers=auth_headers(stranger.id))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Tree not found"


@pytest.mark.asyncio
async def test_owner_still_reads(client, headers, tree, person):
    resp = await client.get(f"/trees/{tree['id']}/persons", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_shared_tree_absent_from_viewer_tree_list(
    client, tree, shared_with, recipient, recipient_headers
):
    await shared_with(recipient)
    resp = await client.get("/trees", headers=recipient_headers)
    assert resp.status_code == 200
    assert resp.json() == []
