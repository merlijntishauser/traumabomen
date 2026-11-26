import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_owned_tree
from app.guest_links import hash_token, sweep_expired_guest_links
from app.models.guest_link import (
    LOCK_THRESHOLD,
    MAX_CIPHERTEXT_CHARS,
    MAX_LIVE_LINKS_PER_TREE,
    MAX_NETWORKS,
    GuestLink,
    GuestLinkNetwork,
)
from app.models.tree import Tree
from app.models.user import User
from app.rate_limiter import check_endpoint_rate_limit, get_client_ip
from app.routers.features import user_has_flag
from app.schemas.guest_links import (
    CreateGuestLinkRequest,
    ExpiryRequest,
    GuestLinkOut,
    RepublishRequest,
)


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(
    prefix="/trees/{tree_id}/guest-links",
    tags=["guest-links"],
    dependencies=[Depends(_no_store)],
)


async def _require_flag(db: AsyncSession, user: User) -> None:
    if not await user_has_flag(db, user, "guest_links"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="guest_links_not_enabled")


def _check_size(ciphertext: str) -> None:
    if len(ciphertext) > MAX_CIPHERTEXT_CHARS:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="copy_too_large")


async def _get_link_or_404(db: AsyncSession, tree: Tree, link_id: uuid.UUID) -> GuestLink:
    link = (
        await db.execute(
            select(GuestLink).where(
                GuestLink.id == link_id,
                GuestLink.tree_id == tree.id,
                GuestLink.expires_at > datetime.now(UTC),
            )
        )
    ).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest link not found")
    return link


async def _network_counts(
    db: AsyncSession, links: list[GuestLink], settings: Settings
) -> dict[uuid.UUID, int | None]:
    if not settings.PROXY_SHARED_SECRET:
        return {link.id: None for link in links}
    rows = await db.execute(
        select(GuestLinkNetwork.guest_link_id, func.count())
        .where(GuestLinkNetwork.guest_link_id.in_([link.id for link in links]))
        .group_by(GuestLinkNetwork.guest_link_id)
    )
    counts = {link_id: count for link_id, count in rows.all()}
    return {link.id: min(counts.get(link.id, 0), MAX_NETWORKS) for link in links}


async def _to_out(
    db: AsyncSession, links: list[GuestLink], settings: Settings
) -> list[GuestLinkOut]:
    counts = await _network_counts(db, links, settings) if links else {}
    return [
        GuestLinkOut(
            id=link.id,
            owner_blob=link.owner_blob,
            created_at=link.created_at,
            published_at=link.published_at,
            expires_at=link.expires_at,
            open_count=link.open_count,
            last_opened_at=link.last_opened_at,
            network_count=counts[link.id],
            failed_total=link.failed_total,
            locked=link.failed_streak >= LOCK_THRESHOLD,
        )
        for link in links
    ]


@router.get("")
async def list_guest_links(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[GuestLinkOut]:
    await sweep_expired_guest_links(db)
    await db.commit()
    links = (
        (
            await db.execute(
                select(GuestLink).where(GuestLink.tree_id == tree.id).order_by(GuestLink.created_at)
            )
        )
        .scalars()
        .all()
    )
    return await _to_out(db, list(links), settings)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_guest_link(
    body: CreateGuestLinkRequest,
    request: Request,
    tree: Tree = Depends(get_owned_tree),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GuestLinkOut:
    await _require_flag(db, user)
    check_endpoint_rate_limit(get_client_ip(request), "guest-link-create")
    _check_size(body.ciphertext)

    # Serialise concurrent creates on the tree row so the cap cannot be raced.
    await db.execute(select(Tree.id).where(Tree.id == tree.id).with_for_update())
    await sweep_expired_guest_links(db)
    live = (
        await db.execute(
            select(func.count()).select_from(GuestLink).where(GuestLink.tree_id == tree.id)
        )
    ).scalar_one()
    if live >= MAX_LIVE_LINKS_PER_TREE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="too_many_links")

    link = GuestLink(
        tree_id=tree.id,
        owner_id=user.id,
        link_id=body.link_id,
        token_hash=hash_token(body.token),
        ciphertext=body.ciphertext,
        owner_blob=body.owner_blob,
        expires_at=datetime.now(UTC) + timedelta(days=body.expires_in_days),
    )
    db.add(link)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="link_already_exists"
        ) from None
    await db.refresh(link)
    return (await _to_out(db, [link], settings))[0]


@router.put("/{link_id}/copy")
async def republish_guest_link(
    link_id: uuid.UUID,
    body: RepublishRequest,
    tree: Tree = Depends(get_owned_tree),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GuestLinkOut:
    await _require_flag(db, user)
    _check_size(body.ciphertext)
    link = await _get_link_or_404(db, tree, link_id)
    link.ciphertext = body.ciphertext
    link.published_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(link)
    return (await _to_out(db, [link], settings))[0]


@router.put("/{link_id}/expiry")
async def set_guest_link_expiry(
    link_id: uuid.UUID,
    body: ExpiryRequest,
    tree: Tree = Depends(get_owned_tree),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GuestLinkOut:
    await _require_flag(db, user)
    link = await _get_link_or_404(db, tree, link_id)
    link.expires_at = datetime.now(UTC) + timedelta(days=body.days)
    await db.commit()
    await db.refresh(link)
    return (await _to_out(db, [link], settings))[0]


@router.post("/{link_id}/unlock")
async def unlock_guest_link(
    link_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GuestLinkOut:
    await _require_flag(db, user)
    link = await _get_link_or_404(db, tree, link_id)
    link.failed_streak = 0
    await db.commit()
    await db.refresh(link)
    return (await _to_out(db, [link], settings))[0]


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def end_guest_link(
    link_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    link = await _get_link_or_404(db, tree, link_id)
    await db.delete(link)
    await db.commit()
