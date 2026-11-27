import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.config import get_settings
from app.main import app
from app.models.feature_flag import FeatureFlag
from app.models.guest_link import MAX_CIPHERTEXT_CHARS, GuestLink, GuestLinkNetwork
from app.models.tree_share import TreeShare
from tests.integration.conftest import TEST_SETTINGS, auth_headers, create_user

LINK_ID = "A" * 22
TOKEN = "B" * 43


def _body(n: int = 0, **over):
    body = {
        "link_id": f"{n:022d}",
        "token": TOKEN,
        "ciphertext": "ct",
        "owner_blob": "blob",
        "expires_in_days": 7,
    }
    body.update(over)
    return body


def _url(tree, suffix=""):
    return f"/trees/{tree['id']}/guest-links{suffix}"


async def _create(client, headers, tree, n=0, **over):
    resp = await client.post(_url(tree), json=_body(n, **over), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
async def other_headers(db_session):
    other = await create_user(db_session, email="other@example.com")
    return auth_headers(other.id)


@pytest.mark.asyncio
async def test_create_and_list(client, headers, tree, guest_links_enabled):
    created = await _create(client, headers, tree)
    assert created["owner_blob"] == "blob"
    assert created["open_count"] == 0
    assert created["locked"] is False
    assert created["network_count"] is None
    resp = await client.get(_url(tree), headers=headers)
    assert resp.status_code == 200
    assert [x["id"] for x in resp.json()] == [created["id"]]
    for item in resp.json():
        assert "ciphertext" not in item
        assert "token_hash" not in item
        assert "token" not in item


@pytest.mark.asyncio
async def test_create_stores_hash_not_token(client, headers, tree, guest_links_enabled, db_session):
    await _create(client, headers, tree)
    link = (await db_session.execute(select(GuestLink))).scalar_one()
    assert link.token_hash != TOKEN
    assert len(link.token_hash) == 64


@pytest.mark.asyncio
async def test_no_store_header(client, headers, tree, guest_links_enabled):
    resp = await client.get(_url(tree), headers=headers)
    assert resp.headers["cache-control"] == "no-store"
    resp = await client.post(_url(tree), json=_body(), headers=headers)
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_create_expiry_is_days_from_now(client, headers, tree, guest_links_enabled):
    created = await _create(client, headers, tree, expires_in_days=14)
    expires = datetime.fromisoformat(created["expires_at"])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    delta = expires - datetime.now(UTC)
    assert timedelta(days=13, hours=23) < delta <= timedelta(days=14)


@pytest.mark.asyncio
async def test_flag_off_refuses_writes_but_list_and_delete_work(
    client, headers, tree, guest_links_enabled, db_session
):
    created = await _create(client, headers, tree)
    flag = await db_session.get(FeatureFlag, "guest_links")
    flag.audience = "disabled"
    await db_session.commit()
    lid = created["id"]
    for method, suffix, body in [
        ("post", "", _body(1)),
        ("put", f"/{lid}/copy", {"ciphertext": "new"}),
        ("put", f"/{lid}/expiry", {"days": 1}),
        ("post", f"/{lid}/unlock", None),
    ]:
        resp = await getattr(client, method)(_url(tree, suffix), json=body, headers=headers)
        assert resp.status_code == 403, (method, suffix)
        assert resp.json()["detail"] == "guest_links_not_enabled"
    assert (await client.get(_url(tree), headers=headers)).status_code == 200
    assert (await client.delete(_url(tree, f"/{lid}"), headers=headers)).status_code == 204
    assert (await client.get(_url(tree), headers=headers)).json() == []


@pytest.mark.asyncio
async def test_flag_missing_refuses_create(client, headers, tree):
    resp = await client.post(_url(tree), json=_body(), headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_sixth_live_link_is_409_and_expired_does_not_count(
    client, headers, tree, guest_links_enabled, db_session
):
    ids = [(await _create(client, headers, tree, n))["id"] for n in range(5)]
    resp = await client.post(_url(tree), json=_body(5), headers=headers)
    assert resp.status_code == 409
    assert resp.json()["detail"] == "too_many_links"

    link = await db_session.get(GuestLink, uuid.UUID(ids[0]))
    link.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()
    assert (await client.post(_url(tree), json=_body(5), headers=headers)).status_code == 201


@pytest.mark.asyncio
async def test_duplicate_link_id_is_409(client, headers, tree, guest_links_enabled):
    await _create(client, headers, tree)
    resp = await client.post(_url(tree), json=_body(), headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_copy_too_large_is_413(client, headers, tree, guest_links_enabled):
    big = "x" * (MAX_CIPHERTEXT_CHARS + 1)
    resp = await client.post(_url(tree), json=_body(ciphertext=big), headers=headers)
    assert resp.status_code == 413
    assert resp.json()["detail"] == "copy_too_large"
    created = await _create(client, headers, tree)
    resp = await client.put(
        _url(tree, f"/{created['id']}/copy"), json={"ciphertext": big}, headers=headers
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "over",
    [
        {"link_id": "short"},
        {"link_id": "A" * 21 + "="},
        {"token": "B" * 42},
        {"token": "B" * 44},
        {"expires_in_days": 3},
        {"expires_in_days": 0},
        {"owner_blob": "x" * 4097},
        {"ciphertext": ""},
    ],
)
async def test_create_validation_422(client, headers, tree, guest_links_enabled, over):
    resp = await client.post(_url(tree), json=_body(**over), headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_expiry_validation_422(client, headers, tree, guest_links_enabled):
    created = await _create(client, headers, tree)
    resp = await client.put(
        _url(tree, f"/{created['id']}/expiry"), json={"days": 5}, headers=headers
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_extend_sets_now_plus_days(client, headers, tree, guest_links_enabled):
    created = await _create(client, headers, tree, expires_in_days=1)
    resp = await client.put(
        _url(tree, f"/{created['id']}/expiry"), json={"days": 30}, headers=headers
    )
    assert resp.status_code == 200
    expires = datetime.fromisoformat(resp.json()["expires_at"])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    assert expires - datetime.now(UTC) > timedelta(days=29)


@pytest.mark.asyncio
async def test_republish_keeps_counts(client, headers, tree, guest_links_enabled, db_session):
    created = await _create(client, headers, tree)
    link = await db_session.get(GuestLink, uuid.UUID(created["id"]))
    link.open_count = 4
    link.failed_total = 2
    link.last_opened_at = datetime.now(UTC)
    old_published = link.published_at
    await db_session.commit()

    resp = await client.put(
        _url(tree, f"/{created['id']}/copy"), json={"ciphertext": "fresh"}, headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["open_count"] == 4
    assert data["failed_total"] == 2
    assert data["last_opened_at"] is not None
    assert data["expires_at"] == created["expires_at"]
    db_session.expire_all()
    row = (await db_session.execute(select(GuestLink.ciphertext, GuestLink.published_at))).one()
    assert row.ciphertext == "fresh"
    assert row.published_at != old_published


@pytest.mark.asyncio
async def test_unlock_resets_streak(client, headers, tree, guest_links_enabled, db_session):
    created = await _create(client, headers, tree)
    link = await db_session.get(GuestLink, uuid.UUID(created["id"]))
    link.failed_streak = 10
    link.failed_total = 10
    await db_session.commit()
    listed = (await client.get(_url(tree), headers=headers)).json()
    assert listed[0]["locked"] is True

    resp = await client.post(_url(tree, f"/{created['id']}/unlock"), headers=headers)
    assert resp.status_code == 200
    assert resp.json()["locked"] is False
    assert resp.json()["failed_total"] == 10


@pytest.mark.asyncio
async def test_delete_removes_link_and_networks(
    client, headers, tree, guest_links_enabled, db_session
):
    created = await _create(client, headers, tree)
    db_session.add(GuestLinkNetwork(guest_link_id=uuid.UUID(created["id"]), network_hash="h"))
    await db_session.commit()
    resp = await client.delete(_url(tree, f"/{created['id']}"), headers=headers)
    assert resp.status_code == 204
    assert (await db_session.execute(select(func.count()).select_from(GuestLink))).scalar_one() == 0
    assert (
        await db_session.execute(select(func.count()).select_from(GuestLinkNetwork))
    ).scalar_one() == 0


@pytest.mark.asyncio
async def test_list_sweeps_expired(client, headers, tree, guest_links_enabled, db_session):
    created = await _create(client, headers, tree)
    link = await db_session.get(GuestLink, uuid.UUID(created["id"]))
    link.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()
    assert (await client.get(_url(tree), headers=headers)).json() == []


@pytest.mark.asyncio
async def test_expired_link_is_404_on_item_routes(
    client, headers, tree, guest_links_enabled, db_session
):
    created = await _create(client, headers, tree)
    link = await db_session.get(GuestLink, uuid.UUID(created["id"]))
    link.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()
    lid = created["id"]
    assert (
        await client.put(_url(tree, f"/{lid}/expiry"), json={"days": 7}, headers=headers)
    ).status_code == 404
    assert (await client.delete(_url(tree, f"/{lid}"), headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_network_count_with_proxy_secret_is_capped(
    client, headers, tree, guest_links_enabled, db_session
):
    created = await _create(client, headers, tree)
    db_session.add_all(
        GuestLinkNetwork(guest_link_id=uuid.UUID(created["id"]), network_hash=f"h{i}")
        for i in range(105)
    )
    await db_session.commit()
    secured = TEST_SETTINGS.model_copy(update={"PROXY_SHARED_SECRET": "s"})
    app.dependency_overrides[get_settings] = lambda: secured
    try:
        listed = (await client.get(_url(tree), headers=headers)).json()
    finally:
        app.dependency_overrides[get_settings] = lambda: TEST_SETTINGS
    assert listed[0]["network_count"] == 100


@pytest.mark.asyncio
async def test_other_user_gets_404_everywhere(
    client, headers, other_headers, tree, guest_links_enabled
):
    created = await _create(client, headers, tree)
    await _assert_all_404(client, other_headers, tree, created["id"])


@pytest.mark.asyncio
async def test_share_recipient_gets_404_everywhere(
    client, headers, tree, guest_links_enabled, db_session, user
):
    recipient = await create_user(db_session, email="recipient@example.com")
    db_session.add(
        TreeShare(
            tree_id=uuid.UUID(tree["id"]),
            owner_id=user.id,
            recipient_email=recipient.email,
            recipient_id=recipient.id,
            encrypted_tree_key="wrapped",
            status="active",
        )
    )
    await db_session.commit()
    created = await _create(client, headers, tree)
    await _assert_all_404(client, auth_headers(recipient.id), tree, created["id"])


async def _assert_all_404(client, other, tree, lid):
    calls = [
        client.get(_url(tree), headers=other),
        client.post(_url(tree), json=_body(9), headers=other),
        client.put(_url(tree, f"/{lid}/copy"), json={"ciphertext": "x"}, headers=other),
        client.put(_url(tree, f"/{lid}/expiry"), json={"days": 7}, headers=other),
        client.post(_url(tree, f"/{lid}/unlock"), headers=other),
        client.delete(_url(tree, f"/{lid}"), headers=other),
    ]
    for call in calls:
        assert (await call).status_code == 404


@pytest.mark.asyncio
async def test_link_of_another_tree_is_404(client, headers, tree, guest_links_enabled):
    created = await _create(client, headers, tree)
    other_tree = (
        await client.post("/trees", json={"encrypted_data": "t2"}, headers=headers)
    ).json()
    lid = created["id"]
    assert (await client.delete(_url(other_tree, f"/{lid}"), headers=headers)).status_code == 404
    assert (
        await client.post(_url(other_tree, f"/{lid}/unlock"), headers=headers)
    ).status_code == 404


@pytest.mark.asyncio
async def test_deleting_tree_removes_links(client, headers, tree, guest_links_enabled, db_session):
    await _create(client, headers, tree)
    resp = await client.delete(f"/trees/{tree['id']}", headers=headers)
    assert resp.status_code == 204
    db_session.expire_all()
    assert (await db_session.execute(select(func.count()).select_from(GuestLink))).scalar_one() == 0


@pytest.mark.asyncio
async def test_list_leaves_ciphertext_unloaded(client, headers, tree, guest_links_enabled):
    """The list query never pulls the (up to 5 MB) ciphertext column."""
    from unittest.mock import patch

    from sqlalchemy import inspect

    from app.routers import guest_links as router

    await _create(client, headers, tree)
    seen: list[set[str]] = []
    original = router._to_out

    async def spy(db, links, settings):
        seen.extend(set(inspect(link).unloaded) for link in links)
        return await original(db, links, settings)

    with patch.object(router, "_to_out", spy):
        resp = await client.get(_url(tree), headers=headers)
    assert resp.status_code == 200
    assert len(seen) == 1
    assert "ciphertext" in seen[0]
