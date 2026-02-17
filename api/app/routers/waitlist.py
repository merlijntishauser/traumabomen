import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from threading import Thread
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.capacity import get_active_user_count
from app.config import Settings, get_settings
from app.database import get_db
from app.email import send_waitlist_approval_email
from app.models.user import User
from app.models.waitlist import WaitlistEntry, WaitlistStatus
from app.schemas.waitlist import WaitlistEntryResponse, WaitlistJoinRequest, WaitlistListResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["waitlist"])

INVITE_TOKEN_EXPIRY_DAYS = 7


def _entry_response(entry: WaitlistEntry) -> WaitlistEntryResponse:
    return WaitlistEntryResponse(
        id=str(entry.id),
        email=entry.email,
        status=entry.status,
        created_at=entry.created_at,
        approved_at=entry.approved_at,
    )


@router.post("/waitlist", status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    body: WaitlistJoinRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    email = body.email.strip().lower()

    # Check if already on waitlist
    result = await db.execute(select(WaitlistEntry).where(WaitlistEntry.email == email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="already_on_waitlist",
        )

    # Check if already registered as a user
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="already_registered",
        )

    entry = WaitlistEntry(email=email)
    db.add(entry)
    await db.commit()

    return {"message": "joined_waitlist"}


@router.get(
    "/admin/waitlist",
    response_model=WaitlistListResponse,
    dependencies=[Depends(require_admin)],
)
async def admin_list_waitlist(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WaitlistListResponse:
    result = await db.execute(select(WaitlistEntry).order_by(WaitlistEntry.created_at.desc()))
    entries = result.scalars().all()

    counts = {s.value: 0 for s in WaitlistStatus}
    items: list[WaitlistEntryResponse] = []
    for entry in entries:
        counts[entry.status] = counts.get(entry.status, 0) + 1
        items.append(_entry_response(entry))

    return WaitlistListResponse(
        items=items,
        waiting=counts[WaitlistStatus.waiting.value],
        approved=counts[WaitlistStatus.approved.value],
        registered=counts[WaitlistStatus.registered.value],
    )


@router.patch(
    "/admin/waitlist/{entry_id}/approve",
    response_model=WaitlistEntryResponse,
    dependencies=[Depends(require_admin)],
)
async def admin_approve_waitlist(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WaitlistEntryResponse:
    result = await db.execute(select(WaitlistEntry).where(WaitlistEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Waitlist entry not found"
        )

    if entry.status != WaitlistStatus.waiting.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entry is not in waiting status",
        )

    # Generate invite token (store hash, email token to user)  # privacy-ok
    token = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(token.encode()).hexdigest()

    entry.status = WaitlistStatus.approved.value
    entry.invite_token = hashed
    entry.invite_expires_at = datetime.now(UTC) + timedelta(days=INVITE_TOKEN_EXPIRY_DAYS)
    entry.approved_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(entry)

    Thread(
        target=send_waitlist_approval_email,
        args=(entry.email, token, settings),
        daemon=True,
    ).start()

    return _entry_response(entry)


@router.delete(
    "/admin/waitlist/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def admin_delete_waitlist(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(WaitlistEntry).where(WaitlistEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Waitlist entry not found"
        )
    await db.delete(entry)
    await db.commit()


@router.get("/admin/waitlist/capacity", dependencies=[Depends(require_admin)])
async def admin_waitlist_capacity(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, int | bool]:
    count = await get_active_user_count(db)
    return {
        "active_users": count,
        "max_active_users": settings.MAX_ACTIVE_USERS,
        "waitlist_enabled": settings.ENABLE_WAITLIST,
    }
