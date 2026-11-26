import hmac
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.guest_links import hash_token, network_hash, sweep_expired_guest_links
from app.models.guest_link import LOCK_THRESHOLD, MAX_NETWORKS, GuestLink, GuestLinkNetwork
from app.models.user import User
from app.rate_limiter import ClientAddress, check_endpoint_rate_limit, get_client_address
from app.routers.features import user_has_flag
from app.schemas.guest_links import GuestOpenRequest, GuestOpenResponse

router = APIRouter(prefix="/guest", tags=["guest"])


async def _refuse(db: AsyncSession, code: int, detail: str) -> HTTPException:
    """Commit what the request changed (sweep, counters) and build the refusal."""
    await db.commit()
    return HTTPException(status_code=code, detail=detail)


async def _owner_has_flag(db: AsyncSession, link: GuestLink) -> bool:
    owner = await db.get(User, link.owner_id)
    return owner is not None and await user_has_flag(db, owner, "guest_links")


async def _record_network(db: AsyncSession, link: GuestLink, address: ClientAddress) -> None:
    """Store the hashed network of a verified address, up to MAX_NETWORKS per link.

    Runs under the link's row lock, so the cap cannot be raced.
    """
    if not address.verified:
        return
    try:
        digest = network_hash(link.link_id, address.ip)
    except ValueError:
        return
    count = await db.scalar(
        select(func.count())
        .select_from(GuestLinkNetwork)
        .where(GuestLinkNetwork.guest_link_id == link.id)
    )
    if (count or 0) >= MAX_NETWORKS:
        return
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    await db.execute(
        insert(GuestLinkNetwork)
        .values(guest_link_id=link.id, network_hash=digest)
        .on_conflict_do_nothing()
    )


@router.post("/open")
async def open_guest_link(
    body: GuestOpenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GuestOpenResponse:
    address = get_client_address(request)
    check_endpoint_rate_limit(address.ip, "guest-open")
    await sweep_expired_guest_links(db)

    now = datetime.now(UTC)
    # Held from reading failed_streak to writing the outcome, so parallel
    # guesses queue. ciphertext is deferred and not loaded here.
    link = (
        await db.execute(
            select(GuestLink)
            .where(GuestLink.link_id == body.link_id, GuestLink.expires_at > now)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if link is None or not await _owner_has_flag(db, link):
        raise await _refuse(db, status.HTTP_404_NOT_FOUND, "not_available")
    if link.failed_streak >= LOCK_THRESHOLD:
        raise await _refuse(db, status.HTTP_423_LOCKED, "locked")
    if not hmac.compare_digest(hash_token(body.token), link.token_hash):
        link.failed_streak += 1
        link.failed_total += 1
        raise await _refuse(db, status.HTTP_401_UNAUTHORIZED, "wrong_passphrase")

    link.failed_streak = 0
    link.open_count += 1
    link.last_opened_at = now
    await _record_network(db, link, address)
    await db.commit()

    ciphertext = await db.scalar(select(GuestLink.ciphertext).where(GuestLink.id == link.id))
    return GuestOpenResponse(ciphertext=ciphertext or "")
