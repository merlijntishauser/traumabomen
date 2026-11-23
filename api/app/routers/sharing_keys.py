from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.rate_limiter import check_endpoint_rate_limit, get_client_ip
from app.routers.features import user_has_flag

router = APIRouter(prefix="/auth", tags=["auth"])


class KeyPairBody(BaseModel):
    public_key: str = Field(max_length=16384)
    encrypted_private_key: str = Field(max_length=32768)


class KeyPairResponse(BaseModel):
    public_key: str
    encrypted_private_key: str


class PublicKeyResponse(BaseModel):
    public_key: str


class ProfileBody(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip() or None


class ProfileResponse(BaseModel):
    display_name: str | None


@router.get("/keys")
async def get_keys(user: User = Depends(get_current_user)) -> KeyPairResponse:
    if not user.public_key or not user.encrypted_private_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No key pair")
    return KeyPairResponse(
        public_key=user.public_key, encrypted_private_key=user.encrypted_private_key
    )


@router.put("/keys", status_code=status.HTTP_200_OK)
async def put_keys(
    body: KeyPairBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    if user.public_key and user.public_key != body.public_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="key_pair_exists")
    if not user.public_key:
        user.public_key = body.public_key
        user.encrypted_private_key = body.encrypted_private_key
        await db.commit()
    return {"message": "Key pair stored"}


@router.get("/public-key/{email}")
async def get_public_key(
    email: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PublicKeyResponse:
    if not await user_has_flag(db, user, "tree_sharing"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="sharing_not_enabled")
    check_endpoint_rate_limit(get_client_ip(request), "public-key-lookup")
    check_endpoint_rate_limit(str(user.id), "public-key-lookup-user")
    result = await db.execute(select(User).where(User.email == email.strip().lower()))
    target = result.scalar_one_or_none()
    if target is None or not target.public_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No key")
    return PublicKeyResponse(public_key=target.public_key)


@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user)) -> ProfileResponse:
    return ProfileResponse(display_name=user.display_name)


@router.put("/profile")
async def put_profile(
    body: ProfileBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProfileResponse:
    user.display_name = body.display_name
    await db.commit()
    return ProfileResponse(display_name=user.display_name)
