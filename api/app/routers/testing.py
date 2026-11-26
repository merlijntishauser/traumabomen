from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import rate_limiter
from app.database import get_db
from app.models.feature_flag import FeatureFlag
from app.models.guest_link import GuestLink
from app.models.user import User

router = APIRouter()

E2E_EMAIL_PREFIX = "e2e-"


@router.post("/test/reset", status_code=204)
async def reset_database(db: AsyncSession = Depends(get_db)) -> None:
    """Delete e2e test users and their cascaded data.

    Only removes users whose email starts with the e2e- prefix.
    All related data (trees, persons, events, etc.) is removed via
    database CASCADE constraints. Only available when ENABLE_TEST_RESET is true.
    """
    e2e_users = await db.execute(select(User.id).where(User.email.startswith(E2E_EMAIL_PREFIX)))
    user_ids = e2e_users.scalars().all()
    if user_ids:
        await db.execute(delete(User).where(User.id.in_(user_ids)))
    await db.commit()


class FeatureFlagBody(BaseModel):
    key: str
    audience: str


@router.post("/test/feature-flag", status_code=204)
async def set_feature_flag(body: FeatureFlagBody, db: AsyncSession = Depends(get_db)) -> None:
    """Create or update a feature flag so e2e journeys can switch features on.

    Upserts, because a database that was not seeded by migrations has no row.
    Only available when ENABLE_TEST_RESET is true.
    """
    flag = await db.get(FeatureFlag, body.key)
    if flag is None:
        db.add(FeatureFlag(key=body.key, audience=body.audience))
    else:
        flag.audience = body.audience
    await db.commit()


class GuestLinkExpireBody(BaseModel):
    link_id: str


@router.post("/test/guest-link-expire", status_code=204)
async def expire_guest_link(body: GuestLinkExpireBody, db: AsyncSession = Depends(get_db)) -> None:
    """Move a guest link's expiry into the past, so e2e journeys can open an expired link.

    link_id is the derived id (unpadded base64url). Only available when
    ENABLE_TEST_RESET is true.
    """
    link = (
        await db.execute(select(GuestLink).where(GuestLink.link_id == body.link_id))
    ).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest link not found")
    link.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db.commit()


@router.post("/test/guest-open-limit-reset", status_code=204)
async def reset_guest_open_limit() -> None:
    """Forget the in-memory guest-open rate limit counts, and nothing else.

    A guest-link journey opens a link more often than one window allows twice,
    so without this a re-run (or a retry) within the window gets 429. Only
    available when ENABLE_TEST_RESET is true.
    """
    suffix = f":{rate_limiter._ADDRESSLESS_ENDPOINT}"
    for key in [key for key in rate_limiter._by_endpoint if key.endswith(suffix)]:
        del rate_limiter._by_endpoint[key]
