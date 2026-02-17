from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.user import User


async def get_active_user_count(db: AsyncSession) -> int:
    """Count verified (active) users."""
    result = await db.execute(
        select(func.count()).select_from(User).where(User.email_verified == True)  # noqa: E712
    )
    return result.scalar() or 0


async def is_registration_open(db: AsyncSession, settings: Settings) -> bool:
    """Check whether new registrations are allowed under the current cap."""
    if not settings.ENABLE_WAITLIST:
        return True
    if settings.MAX_ACTIVE_USERS <= 0:
        return True
    count = await get_active_user_count(db)
    return count < settings.MAX_ACTIVE_USERS
