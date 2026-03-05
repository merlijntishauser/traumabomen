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


@router.get("/features")
async def get_features(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Return feature flags enabled for the current user."""
    result = await db.execute(select(FeatureFlag))
    flags = result.scalars().all()

    # Get the set of flag keys this user is selected for
    selected_result = await db.execute(
        select(FeatureFlagUser.flag_key).where(FeatureFlagUser.user_id == user.id)
    )
    selected_keys = {row for row in selected_result.scalars().all()}

    response: dict[str, bool] = {}
    for flag in flags:
        enabled = (
            flag.audience == "all"
            or (flag.audience == "admins" and user.is_admin)
            or (flag.audience == "selected" and flag.key in selected_keys)
        )
        response[flag.key] = enabled

    return response


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


@admin_router.put("/features/{key}")
async def admin_update_feature(
    key: str,
    body: UpdateFeatureFlagRequest,
    db: AsyncSession = Depends(get_db),
) -> AdminFeatureFlag:
    """Update a feature flag's audience and optional selected users (admin only)."""
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature flag not found",
        )

    flag.audience = body.audience

    # Replace selected users
    await db.execute(delete(FeatureFlagUser).where(FeatureFlagUser.flag_key == key))

    if body.audience == "selected" and body.user_ids:
        for uid in body.user_ids:
            db.add(FeatureFlagUser(flag_key=key, user_id=uid))

    await db.commit()

    # Return updated state
    user_result = await db.execute(
        select(FeatureFlagUser.user_id).where(FeatureFlagUser.flag_key == key)
    )
    user_ids = [str(uid) for uid in user_result.scalars().all()]

    return AdminFeatureFlag(
        key=flag.key,
        audience=flag.audience,
        selected_user_ids=user_ids,
    )
