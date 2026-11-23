"""Tests for key pair, public key lookup and profile endpoints."""

import pytest

from tests.integration.conftest import auth_headers, create_user

PAIR = {"public_key": "pub-1", "encrypted_private_key": "enc-priv-1"}


@pytest.mark.asyncio
async def test_get_keys_404_before_upload(client, user, headers):
    resp = await client.get("/auth/keys", headers=headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No key pair"


@pytest.mark.asyncio
async def test_put_keys_once_then_409(client, user, headers):
    assert (await client.put("/auth/keys", json=PAIR, headers=headers)).status_code == 200
    other = {"public_key": "pub-2", "encrypted_private_key": "enc-priv-2"}
    resp = await client.put("/auth/keys", json=other, headers=headers)
    assert resp.status_code == 409
    assert resp.json()["detail"] == "key_pair_exists"
    got = await client.get("/auth/keys", headers=headers)
    assert got.json() == PAIR


@pytest.mark.asyncio
async def test_put_keys_same_public_key_is_idempotent(client, user, headers):
    await client.put("/auth/keys", json=PAIR, headers=headers)
    resp = await client.put("/auth/keys", json=PAIR, headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_public_key_requires_auth(client):
    resp = await client.get("/auth/public-key/bob@x.org")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_public_key_unknown_email_and_keyless_user_same_404(
    client, db_session, user, headers
):
    await create_user(db_session, email="keyless@x.org")
    unknown = await client.get("/auth/public-key/nobody@x.org", headers=headers)
    keyless = await client.get("/auth/public-key/keyless@x.org", headers=headers)
    assert unknown.status_code == keyless.status_code == 404
    assert unknown.json() == keyless.json() == {"detail": "No key"}


@pytest.mark.asyncio
async def test_public_key_lookup_normalizes_email(client, db_session, user, headers):
    bob = await create_user(db_session, email="bob@x.org")
    await client.put("/auth/keys", json=PAIR, headers=auth_headers(bob.id))
    resp = await client.get("/auth/public-key/ Bob@X.org", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"public_key": "pub-1"}


@pytest.mark.asyncio
async def test_profile_display_name_roundtrip_and_clear(client, user, headers):
    assert (await client.get("/auth/profile", headers=headers)).json() == {"display_name": None}
    resp = await client.put("/auth/profile", json={"display_name": "  Alice  "}, headers=headers)
    assert resp.json() == {"display_name": "Alice"}
    assert (await client.get("/auth/profile", headers=headers)).json() == {"display_name": "Alice"}
    resp = await client.put("/auth/profile", json={"display_name": ""}, headers=headers)
    assert resp.json() == {"display_name": None}
    resp = await client.put("/auth/profile", json={"display_name": None}, headers=headers)
    assert resp.json() == {"display_name": None}


@pytest.mark.asyncio
async def test_profile_display_name_too_long(client, user, headers):
    resp = await client.put("/auth/profile", json={"display_name": "x" * 101}, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_key_ring_put_with_private_key_updates_both(client, user, headers):
    resp = await client.put(
        "/auth/key-ring",
        json={"encrypted_key_ring": "ring", "encrypted_private_key": "priv"},
        headers=headers,
    )
    assert resp.status_code == 200
    await client.put("/auth/keys", json=PAIR, headers=headers)
    await client.put(
        "/auth/key-ring",
        json={"encrypted_key_ring": "ring2", "encrypted_private_key": "priv2"},
        headers=headers,
    )
    assert (await client.get("/auth/key-ring", headers=headers)).json() == {
        "encrypted_key_ring": "ring2"
    }
    assert (await client.get("/auth/keys", headers=headers)).json()[
        "encrypted_private_key"
    ] == "priv2"


@pytest.mark.asyncio
async def test_key_ring_put_without_private_key_leaves_it(client, user, headers):
    await client.put("/auth/keys", json=PAIR, headers=headers)
    await client.put("/auth/key-ring", json={"encrypted_key_ring": "ring"}, headers=headers)
    got = await client.get("/auth/keys", headers=headers)
    assert got.json()["encrypted_private_key"] == "enc-priv-1"
