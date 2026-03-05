from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.auth import get_current_user, require_admin
from app.database import get_db
from app.models.feature_flag import FeatureFlag, FeatureFlagUser
from app.models.user import User
from app.schemas.features import (
    AdminFeatureFlag,
    AdminFeaturesResponse,
    UpdateFeatureFlagRequest,
)

router = APIRouter(tags=["features"])
admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _is_flag_enabled(flag: FeatureFlag, user: User, selected_keys: set[str]) -> bool:
    match flag.audience:
        case "all":
            return True
        case "admins":
            return user.is_admin
        case "selected":
            return flag.key in selected_keys
        case _:
            return False


@router.get("/features")
async def get_features(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Return feature flags enabled for the current user."""
    result = await db.execute(select(FeatureFlag))
    flags = result.scalars().all()

    selected_result = await db.execute(
        select(FeatureFlagUser.flag_key).where(FeatureFlagUser.user_id == user.id)
    )
    selected_keys = set(selected_result.scalars().all())

    return {flag.key: _is_flag_enabled(flag, user, selected_keys) for flag in flags}


@admin_router.get("/features", response_model=AdminFeaturesResponse)
async def admin_get_features(
    db: AsyncSession = Depends(get_db),
) -> AdminFeaturesResponse:
    """Return all feature flags with full detail (admin only)."""
    flags_result = await db.execute(select(FeatureFlag))
    flags = flags_result.scalars().all()

    users_result = await db.execute(select(FeatureFlagUser))
    users_by_key: dict[str, list[str]] = {}
    for row in users_result.scalars().all():
        users_by_key.setdefault(row.flag_key, []).append(str(row.user_id))

    return AdminFeaturesResponse(
        flags=[
            AdminFeatureFlag(
                key=f.key,
                audience=f.audience,
                selected_user_ids=users_by_key.get(f.key, []),
            )
            for f in flags
        ]
    )


async def _get_flag_or_404(db: AsyncSession, key: str) -> FeatureFlag:
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature flag not found",
        )
    return flag


async def _build_admin_flag(db: AsyncSession, flag: FeatureFlag) -> AdminFeatureFlag:
    user_result = await db.execute(
        select(FeatureFlagUser.user_id).where(FeatureFlagUser.flag_key == flag.key)
    )
    return AdminFeatureFlag(
        key=flag.key,
        audience=flag.audience,
        selected_user_ids=[str(uid) for uid in user_result.scalars().all()],
    )


async def _validate_user_ids(
    user_ids: list,
    db: AsyncSession,  # type: ignore[type-arg]
) -> None:
    """Raise 422 if any user_ids don't exist in the database."""
    result = await db.execute(select(User.id).where(User.id.in_(user_ids)))
    existing_ids = set(result.scalars().all())
    missing = [str(uid) for uid in user_ids if uid not in existing_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"User IDs not found: {', '.join(missing)}",
        )


@admin_router.put("/features/{key}")
async def admin_update_feature(
    key: str,
    body: UpdateFeatureFlagRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminFeatureFlag:
    """Update a feature flag's audience and optional selected users (admin only)."""
    flag = await _get_flag_or_404(db, key)
    flag.audience = body.audience

    await db.execute(delete(FeatureFlagUser).where(FeatureFlagUser.flag_key == key))
    if body.audience == "selected" and body.user_ids:
        await _validate_user_ids(body.user_ids, db)
        for uid in body.user_ids:
            db.add(FeatureFlagUser(flag_key=key, user_id=uid))

    await db.commit()
    return await _build_admin_flag(db, flag)
