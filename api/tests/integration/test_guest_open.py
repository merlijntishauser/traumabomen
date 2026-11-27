import asyncio
import base64
import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import func, select, update

from app.database import Base
from app.models.feature_flag import FeatureFlag
from app.models.guest_link import GuestLink, GuestLinkNetwork
from tests.integration.conftest import _IS_SQLITE, TEST_SETTINGS

LINK_ID = "L" * 22
TOKEN = "T" * 43
WRONG = "W" * 43
SECRET = "proxy-secret"
OPEN = "/guest/open"


def _token_hash(token: str) -> str:
    return hashlib.sha256(base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))).hexdigest()


@pytest.fixture
async def link(db_session, user, tree):
    row = GuestLink(
        tree_id=uuid.UUID(tree["id"]),
        owner_id=user.id,
        link_id=LINK_ID,
        token_hash=_token_hash(TOKEN),
        ciphertext="the-ciphertext",
        owner_blob="blob",
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db_session.add(row)
    await db_session.commit()
    return row


@pytest.fixture
def verified():
    """Make the proxy secret known, so requests carrying it give a verified address."""
    secured = TEST_SETTINGS.model_copy(update={"PROXY_SHARED_SECRET": SECRET})
    with patch("app.rate_limiter.get_settings", return_value=secured):
        yield


def _from(ip: str, secret: str = SECRET) -> dict:
    return {"x-real-ip": ip, "x-proxy-secret": secret}


async def _open(client, token=TOKEN, link_id=LINK_ID, headers=None):
    return await client.post(OPEN, json={"link_id": link_id, "token": token}, headers=headers)


async def _row(db_session) -> GuestLink:
    db_session.expire_all()
    return (await db_session.execute(select(GuestLink))).scalar_one()


async def _networks(db_session) -> int:
    return await db_session.scalar(select(func.count()).select_from(GuestLinkNetwork))


@pytest.mark.asyncio
async def test_open_returns_ciphertext_and_counts(client, link, guest_links_enabled, db_session):
    resp = await _open(client)
    assert resp.status_code == 200
    assert resp.json() == {"ciphertext": "the-ciphertext"}
    assert resp.headers["cache-control"] == "no-store"
    row = await _row(db_session)
    assert row.open_count == 1
    assert row.last_opened_at is not None
    assert row.failed_streak == 0
    await _open(client)
    assert (await _row(db_session)).open_count == 2


@pytest.mark.asyncio
async def test_not_available_bodies_are_identical(client, link, guest_links_enabled, db_session):
    unknown = await _open(client, link_id="U" * 22)

    await db_session.execute(
        update(GuestLink).values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await db_session.commit()
    with patch("app.routers.guest.sweep_expired_guest_links", new=AsyncMock(return_value=0)):
        expired = await _open(client)
    assert await db_session.scalar(select(func.count()).select_from(GuestLink)) == 1

    await db_session.execute(
        update(GuestLink).values(expires_at=datetime.now(UTC) + timedelta(days=1))
    )
    flag = await db_session.get(FeatureFlag, "guest_links")
    flag.audience = "disabled"
    await db_session.commit()
    flag_off = await _open(client)

    for resp in (unknown, expired, flag_off):
        assert resp.status_code == 404
        assert resp.headers["cache-control"] == "no-store"
    assert unknown.content == expired.content == flag_off.content
    assert unknown.json() == {"detail": "not_available"}
    # The flag-off refusal counts nothing.
    assert (await _row(db_session)).open_count == 0


@pytest.mark.asyncio
async def test_open_sweeps_expired(client, link, guest_links_enabled, db_session):
    await db_session.execute(
        update(GuestLink).values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await db_session.commit()
    assert (await _open(client)).status_code == 404
    assert await db_session.scalar(select(func.count()).select_from(GuestLink)) == 0


@pytest.mark.asyncio
async def test_wrong_token_is_401_and_counts(client, link, guest_links_enabled, db_session):
    resp = await _open(client, token=WRONG)
    assert resp.status_code == 401
    assert resp.json() == {"detail": "wrong_passphrase"}
    assert resp.headers["cache-control"] == "no-store"
    row = await _row(db_session)
    assert (row.failed_streak, row.failed_total, row.open_count) == (1, 1, 0)


@pytest.mark.asyncio
async def test_ten_wrong_then_right_is_423(client, link, guest_links_enabled, db_session):
    for _ in range(10):
        assert (await _open(client, token=WRONG)).status_code == 401
    resp = await _open(client)
    assert resp.status_code == 423
    assert resp.json() == {"detail": "locked"}
    assert resp.headers["cache-control"] == "no-store"
    # Locked is decided before the token, so a further wrong guess counts nothing.
    assert (await _open(client, token=WRONG)).status_code == 423
    row = await _row(db_session)
    assert (row.failed_streak, row.failed_total, row.open_count) == (10, 10, 0)


@pytest.mark.asyncio
async def test_wrong_token_after_unlock_counts_from_zero(
    client, link, guest_links_enabled, db_session
):
    for _ in range(10):
        await _open(client, token=WRONG)
    await db_session.execute(update(GuestLink).values(failed_streak=0))
    await db_session.commit()
    assert (await _open(client, token=WRONG)).status_code == 401
    row = await _row(db_session)
    assert (row.failed_streak, row.failed_total) == (1, 11)
    assert (await _open(client)).status_code == 200


@pytest.mark.asyncio
async def test_correct_open_resets_streak(client, link, guest_links_enabled, db_session):
    for _ in range(3):
        await _open(client, token=WRONG)
    assert (await _open(client)).status_code == 200
    row = await _row(db_session)
    assert (row.failed_streak, row.failed_total) == (0, 3)


@pytest.mark.asyncio
async def test_owner_flag_selected_users(client, link, user, db_session):
    from app.models.feature_flag import FeatureFlagUser

    db_session.add(FeatureFlag(key="guest_links", audience="selected"))
    await db_session.commit()
    assert (await _open(client)).status_code == 404
    db_session.add(FeatureFlagUser(flag_key="guest_links", user_id=user.id))
    await db_session.commit()
    assert (await _open(client)).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"link_id": "short", "token": TOKEN},
        {"link_id": LINK_ID, "token": "short"},
        {"link_id": "!" * 22, "token": TOKEN},
        {"link_id": LINK_ID},
    ],
)
async def test_malformed_body_is_422(client, link, guest_links_enabled, body):
    resp = await client.post(OPEN, json=body)
    assert resp.status_code == 422
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_same_address_twice_is_one_network(
    client, link, guest_links_enabled, db_session, verified
):
    await _open(client, headers=_from("203.0.113.7"))
    await _open(client, headers=_from("203.0.113.7"))
    assert await _networks(db_session) == 1
    await _open(client, headers=_from("203.0.113.8"))
    assert await _networks(db_session) == 2


@pytest.mark.asyncio
async def test_ipv6_same_64_is_one_network(client, link, guest_links_enabled, db_session, verified):
    await _open(client, headers=_from("2001:db8:1:2::1"))
    await _open(client, headers=_from("2001:db8:1:2:ffff::9"))
    assert await _networks(db_session) == 1
    await _open(client, headers=_from("2001:db8:1:3::1"))
    assert await _networks(db_session) == 2


@pytest.mark.asyncio
async def test_wrong_token_records_no_network(
    client, link, guest_links_enabled, db_session, verified
):
    await _open(client, token=WRONG, headers=_from("203.0.113.7"))
    assert await _networks(db_session) == 0


@pytest.mark.asyncio
async def test_scoped_ipv6_counts_as_its_64(
    client, link, guest_links_enabled, db_session, verified
):
    assert (await _open(client, headers=_from("fe80::1%eth0"))).status_code == 200
    assert (await _open(client, headers=_from("fe80::2"))).status_code == 200
    assert await _networks(db_session) == 1


@pytest.mark.asyncio
async def test_unhashable_address_opens_without_network(
    client, link, guest_links_enabled, db_session, verified
):
    with patch("app.routers.guest.network_hash", side_effect=ValueError("bad")):
        resp = await _open(client, headers=_from("203.0.113.7"))
    assert resp.status_code == 200
    assert await _networks(db_session) == 0


@pytest.mark.asyncio
async def test_unverified_addresses_record_no_network(
    client, link, guest_links_enabled, db_session, verified
):
    forged = await _open(client, headers={"x-real-ip": "203.0.113.7"})
    wrong_secret = await _open(client, headers=_from("203.0.113.8", secret="guess"))
    assert forged.status_code == wrong_secret.status_code == 200
    assert await _networks(db_session) == 0
    assert (await _row(db_session)).open_count == 2


@pytest.mark.asyncio
async def test_no_secret_configured_records_no_network(
    client, link, guest_links_enabled, db_session
):
    assert (await _open(client, headers=_from("203.0.113.7"))).status_code == 200
    assert await _networks(db_session) == 0


@pytest.mark.asyncio
async def test_network_cap(client, link, guest_links_enabled, db_session, verified):
    db_session.add_all(
        GuestLinkNetwork(guest_link_id=link.id, network_hash=f"{i:064x}") for i in range(99)
    )
    await db_session.commit()
    await _open(client, headers=_from("203.0.113.100"))
    assert await _networks(db_session) == 100
    resp = await _open(client, headers=_from("203.0.113.101"))
    assert resp.status_code == 200
    assert await _networks(db_session) == 100
    assert (await _row(db_session)).open_count == 2


@pytest.mark.asyncio
async def test_no_column_holds_the_raw_address(
    client, link, guest_links_enabled, db_session, verified
):
    addresses = ["203.0.113.77", "2001:db8:aa:bb::5"]
    for ip in addresses:
        assert (await _open(client, headers=_from(ip))).status_code == 200
    await _open(client, token=WRONG, headers=_from("198.51.100.9"))
    addresses.append("198.51.100.9")
    needles = [*addresses, "2001:db8:aa:bb::", "2001:db8:aa:bb::/64"]
    assert await _networks(db_session) == 2
    async with db_session.bind.connect() as conn:
        for table in Base.metadata.sorted_tables:
            for row in (await conn.execute(select(table))).all():
                for value in row:
                    text = str(value)
                    for needle in needles:
                        assert needle not in text, (table.name, needle)


@pytest.mark.asyncio
async def test_rate_limited_after_twenty(client, link, guest_links_enabled):
    for _ in range(20):
        await _open(client, token=WRONG)
    resp = await _open(client)
    assert resp.status_code == 429
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_login_sweeps_expired(client, link, user, db_session):
    await db_session.execute(
        update(GuestLink).values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await db_session.commit()
    resp = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "TestPassword1"}
    )
    assert resp.status_code == 200
    assert await db_session.scalar(select(func.count()).select_from(GuestLink)) == 0


@pytest.mark.asyncio
async def test_owner_endpoint_403_is_no_store(client, headers, tree):
    resp = await client.post(
        f"/trees/{tree['id']}/guest-links",
        json={
            "link_id": LINK_ID,
            "token": TOKEN,
            "ciphertext": "ct",
            "owner_blob": "b",
            "expires_in_days": 7,
        },
        headers=headers,
    )
    assert resp.status_code == 403
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_other_routes_are_not_no_store(client, headers):
    resp = await client.get("/trees", headers=headers)
    assert resp.status_code == 200
    assert "cache-control" not in resp.headers


@pytest.mark.asyncio
@pytest.mark.skipif(_IS_SQLITE, reason="row locks need PostgreSQL")
async def test_parallel_wrong_guesses_cannot_pass_the_cap(
    client, link, guest_links_enabled, db_session
):
    results = await asyncio.gather(*(_open(client, token=WRONG) for _ in range(20)))
    codes = sorted(r.status_code for r in results)
    assert codes.count(401) == 10
    assert codes.count(423) == 10
    row = await _row(db_session)
    assert (row.failed_streak, row.failed_total) == (10, 10)


@pytest.mark.asyncio
async def test_link_ending_before_ciphertext_read_is_not_available(
    client, link, guest_links_enabled
):
    from sqlalchemy.ext.asyncio import AsyncSession

    original = AsyncSession.scalar

    async def ended(self, statement, *args, **kwargs):
        result = await original(self, statement, *args, **kwargs)
        return None if result == "the-ciphertext" else result

    with patch.object(AsyncSession, "scalar", ended):
        resp = await _open(client)
    assert resp.status_code == 404
    assert resp.json() == {"detail": "not_available"}
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_server_error_on_guest_path_is_no_store(link, guest_links_enabled):
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        with patch("app.routers.guest.sweep_expired_guest_links", side_effect=RuntimeError("x")):
            guest = await _open(c)
    assert guest.status_code == 500
    assert guest.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_token_check_leaves_ciphertext_unloaded(client, link, guest_links_enabled):
    """The locked row read for the token check does not load the ciphertext."""
    from sqlalchemy import inspect

    from app.routers import guest as router

    seen: list[set[str]] = []
    original = router._record_network

    async def spy(db, row, address):
        seen.append(set(inspect(row).unloaded))
        await original(db, row, address)

    with patch.object(router, "_record_network", spy):
        resp = await _open(client)
    assert resp.status_code == 200
    assert resp.json() == {"ciphertext": "the-ciphertext"}
    assert len(seen) == 1
    assert "ciphertext" in seen[0]
