from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.feature_flag import FeatureFlag
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
