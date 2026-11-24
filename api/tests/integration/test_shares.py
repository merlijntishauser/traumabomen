"""Tests for creating, completing and revoking tree shares."""

import uuid
from unittest.mock import patch

import pytest

from app.email import send_share_invite_email
from tests.integration.conftest import auth_headers, create_user

KEY = "wrapped-key"
PAIR = {"public_key": "pub-bob", "encrypted_private_key": "enc-priv-bob"}


async def _keyed_user(client, db_session, email="bob@x.org"):
    bob = await create_user(db_session, email=email)
    resp = await client.put("/auth/keys", json=PAIR, headers=auth_headers(bob.id))
    assert resp.status_code == 200
    return bob


async def _share(client, headers, tree, email, key=None, **extra):
    body = {"recipient_email": email, **extra}
    if key is not None:
        body["encrypted_tree_key"] = key
    return await client.post(f"/trees/{tree['id']}/shares", json=body, headers=headers)


@pytest.mark.asyncio
async def test_share_requires_flag(client, user, headers, tree):
    resp = await _share(client, headers, tree, "bob@x.org")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "sharing_not_enabled"


@pytest.mark.asyncio
async def test_share_active_with_keyed_recipient(
    client, db_session, user, headers, tree, sharing_enabled
):
    bob = await _keyed_user(client, db_session)
    resp = await _share(client, headers, tree, "bob@x.org", KEY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "active"
    assert data["recipient_email"] == "bob@x.org"
    assert data["tree_id"] == tree["id"]
    keys = await client.get("/auth/shared-keys", headers=auth_headers(bob.id))
    assert keys.json()[0]["encrypted_tree_key"] == KEY
    read = await client.get(f"/trees/{tree['id']}", headers=auth_headers(bob.id))
    assert read.status_code == 200


@pytest.mark.asyncio
async def test_share_requires_wrapped_key_for_keyed_recipient(
    client, db_session, user, headers, tree, sharing_enabled
):
    await _keyed_user(client, db_session)
    resp = await _share(client, headers, tree, "bob@x.org")
    assert resp.status_code == 422
    assert resp.json()["detail"] == "encrypted_tree_key_required"


@pytest.mark.asyncio
async def test_share_pending_for_unknown_email_sends_invite(
    client, user, headers, tree, sharing_enabled
):
    with patch("app.routers.shares.send_email_background") as send:
        resp = await _share(client, headers, tree, "new@x.org", KEY, language="nl")
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"
    send.assert_called_once()
    args = send.call_args[0]
    assert args[0] is send_share_invite_email
    assert args[1] == "new@x.org"
    assert args[3] == "nl"


@pytest.mark.asyncio
async def test_share_pending_for_keyless_user_sends_no_email(
    client, db_session, user, headers, tree, sharing_enabled
):
    await create_user(db_session, email="keyless@x.org")
    with patch("app.routers.shares.send_email_background") as send:
        resp = await _share(client, headers, tree, "keyless@x.org", KEY)
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"
    send.assert_not_called()


@pytest.mark.asyncio
async def test_share_normalizes_email(client, user, headers, tree, sharing_enabled):
    with patch("app.routers.shares.send_email_background"):
        resp = await _share(client, headers, tree, " New@X.org ")
    assert resp.status_code == 201
    assert resp.json()["recipient_email"] == "new@x.org"


@pytest.mark.asyncio
async def test_cannot_share_with_self(client, user, headers, tree, sharing_enabled):
    for email in ("test@example.com", "TEST@Example.com"):
        resp = await _share(client, headers, tree, email)
        assert resp.status_code == 422
        assert resp.json()["detail"] == "cannot_share_with_self"


@pytest.mark.asyncio
async def test_duplicate_share_409(client, user, headers, tree, sharing_enabled):
    with patch("app.routers.shares.send_email_background"):
        assert (await _share(client, headers, tree, "new@x.org")).status_code == 201
        resp = await _share(client, headers, tree, "NEW@x.org")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "already_shared"


@pytest.mark.asyncio
async def test_pending_cap_20(client, db_session, user, headers, tree, sharing_enabled):
    from app.models.tree_share import SHARE_PENDING, TreeShare

    db_session.add_all(
        TreeShare(
            tree_id=uuid.UUID(tree["id"]),
            owner_id=user.id,
            recipient_email=f"p{i}@x.org",
            status=SHARE_PENDING,
        )
        for i in range(20)
    )
    await db_session.commit()
    resp = await _share(client, headers, tree, "p20@x.org")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "pending_share_limit"


@pytest.mark.asyncio
async def test_share_rate_limited(client, user, headers, tree, sharing_enabled):
    from app.rate_limiter import ENDPOINT_RATE_LIMIT

    with patch("app.routers.shares.send_email_background"):
        for i in range(ENDPOINT_RATE_LIMIT):
            r = await _share(client, headers, tree, f"r{i}@x.org")
            assert r.status_code in (201, 409)
        resp = await _share(client, headers, tree, "over@x.org")
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_complete_pending_share(client, db_session, user, headers, tree, sharing_enabled):
    with patch("app.routers.shares.send_email_background"):
        created = (await _share(client, headers, tree, "bob@x.org")).json()
    bob = await _keyed_user(client, db_session)
    pending = await client.get("/auth/pending-shares", headers=headers)
    assert pending.json() == [
        {
            "share_id": created["id"],
            "tree_id": tree["id"],
            "recipient_email": "bob@x.org",
            "recipient_public_key": "pub-bob",
        }
    ]
    resp = await client.put(
        f"/trees/{tree['id']}/shares/{created['id']}",
        json={"encrypted_tree_key": KEY},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"
    assert (await client.get("/auth/pending-shares", headers=headers)).json() == []
    keys = await client.get("/auth/shared-keys", headers=auth_headers(bob.id))
    assert keys.json()[0]["share_id"] == created["id"]
    again = await client.put(
        f"/trees/{tree['id']}/shares/{created['id']}",
        json={"encrypted_tree_key": KEY},
        headers=headers,
    )
    assert again.status_code == 409
    assert again.json()["detail"] == "already_active"


@pytest.mark.asyncio
async def test_complete_requires_recipient_key(client, user, headers, tree, sharing_enabled):
    with patch("app.routers.shares.send_email_background"):
        created = (await _share(client, headers, tree, "bob@x.org")).json()
    resp = await client.put(
        f"/trees/{tree['id']}/shares/{created['id']}",
        json={"encrypted_tree_key": KEY},
        headers=headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "recipient_has_no_key"


@pytest.mark.asyncio
async def test_revoke_removes_access(client, db_session, user, headers, tree, sharing_enabled):
    bob = await _keyed_user(client, db_session)
    created = (await _share(client, headers, tree, "bob@x.org", KEY)).json()
    bob_headers = auth_headers(bob.id)
    assert (await client.get(f"/trees/{tree['id']}", headers=bob_headers)).status_code == 200
    resp = await client.delete(f"/trees/{tree['id']}/shares/{created['id']}", headers=headers)
    assert resp.status_code == 204
    assert (await client.get(f"/trees/{tree['id']}", headers=bob_headers)).status_code == 404
    assert (await client.get("/auth/shared-keys", headers=bob_headers)).json() == []


@pytest.mark.asyncio
async def test_non_owner_cannot_list_create_complete_or_revoke(
    client, db_session, user, headers, tree, sharing_enabled
):
    bob = await _keyed_user(client, db_session)
    created = (await _share(client, headers, tree, "bob@x.org", KEY)).json()
    mallory = await create_user(db_session, email="mallory@x.org")
    for h in (auth_headers(bob.id), auth_headers(mallory.id)):
        base = f"/trees/{tree['id']}/shares"
        assert (await client.get(base, headers=h)).status_code == 404
        assert (await _share(client, h, tree, "z@x.org")).status_code == 404
        put = await client.put(
            f"{base}/{created['id']}", json={"encrypted_tree_key": "k"}, headers=h
        )
        assert put.status_code == 404
        assert (await client.delete(f"{base}/{created['id']}", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_owner_lists_shares_with_display_name(
    client, db_session, user, headers, tree, sharing_enabled
):
    bob = await _keyed_user(client, db_session)
    await client.put("/auth/profile", json={"display_name": "Bob"}, headers=auth_headers(bob.id))
    await _share(client, headers, tree, "bob@x.org", KEY)
    resp = await client.get(f"/trees/{tree['id']}/shares", headers=headers)
    assert [s["recipient_display_name"] for s in resp.json()] == ["Bob"]


@pytest.mark.asyncio
async def test_shared_keys_lists_only_active_for_me(
    client, db_session, user, headers, tree, sharing_enabled
):
    bob = await _keyed_user(client, db_session)
    carol = await _keyed_user(client, db_session, email="carol@x.org")
    await _share(client, headers, tree, "bob@x.org", KEY)
    await _share(client, headers, tree, "carol@x.org", "carol-key")
    resp = await client.get("/auth/shared-keys", headers=auth_headers(bob.id))
    assert [(k["encrypted_tree_key"], k["owner_email"]) for k in resp.json()] == [
        (KEY, "test@example.com")
    ]
    assert resp.json()[0]["owner_display_name"] is None
    resp = await client.get("/auth/shared-keys", headers=auth_headers(carol.id))
    assert [k["encrypted_tree_key"] for k in resp.json()] == ["carol-key"]
    assert (await client.get("/auth/shared-keys", headers=headers)).json() == []


@pytest.mark.asyncio
async def test_pending_shares_lists_only_completable(
    client, db_session, user, headers, tree, sharing_enabled
):
    await create_user(db_session, email="keyless@x.org")
    with patch("app.routers.shares.send_email_background"):
        await _share(client, headers, tree, "keyless@x.org")
        await _share(client, headers, tree, "ghost@x.org")
    assert (await client.get("/auth/pending-shares", headers=headers)).json() == []
    bob = await create_user(db_session, email="bob@x.org")
    bob_headers = auth_headers(bob.id)
    other_tree = (
        await client.post("/trees", json={"encrypted_data": "x"}, headers=bob_headers)
    ).json()
    with patch("app.routers.shares.send_email_background"):
        created = (await _share(client, bob_headers, other_tree, "carol@x.org")).json()
    await _keyed_user(client, db_session, email="carol@x.org")
    # Bob's share is now completable: it shows up for Bob, never for Alice.
    bobs = (await client.get("/auth/pending-shares", headers=bob_headers)).json()
    assert [s["share_id"] for s in bobs] == [created["id"]]
    assert (await client.get("/auth/pending-shares", headers=headers)).json() == []


@pytest.mark.asyncio
async def test_reshare_after_revoke(client, db_session, user, headers, tree, sharing_enabled):
    await _keyed_user(client, db_session)
    created = (await _share(client, headers, tree, "bob@x.org", KEY)).json()
    await client.delete(f"/trees/{tree['id']}/shares/{created['id']}", headers=headers)
    resp = await _share(client, headers, tree, "bob@x.org", KEY)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_pending_share_hides_recipient_display_name(
    client, db_session, user, headers, tree, sharing_enabled
):
    keyless = await create_user(db_session, email="keyless@x.org")
    await client.put(
        "/auth/profile", json={"display_name": "Kees"}, headers=auth_headers(keyless.id)
    )
    resp = await _share(client, headers, tree, "keyless@x.org")
    assert resp.json()["status"] == "pending"
    assert resp.json()["recipient_display_name"] is None
    listed = await client.get(f"/trees/{tree['id']}/shares", headers=headers)
    assert [(s["status"], s["recipient_display_name"]) for s in listed.json()] == [
        ("pending", None)
    ]


@pytest.mark.asyncio
async def test_invite_sent_once_per_address_within_cooldown(
    client, user, headers, tree, sharing_enabled
):
    with patch("app.routers.shares.send_email_background") as send:
        first = (await _share(client, headers, tree, "new@x.org")).json()
        await client.delete(f"/trees/{tree['id']}/shares/{first['id']}", headers=headers)
        again = await _share(client, headers, tree, "NEW@x.org")
    assert again.status_code == 201
    assert again.json()["status"] == "pending"
    send.assert_called_once()
