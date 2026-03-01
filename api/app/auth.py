import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def check_password_strength(password: str) -> dict[str, object]:
    if len(password) < 8:
        return {"score": 0, "level": "weak"}

    score = 1 + sum(
        [
            len(password) >= 12,
            len(password) >= 16,
            bool(re.search(r"[a-z]", password)) and bool(re.search(r"[A-Z]", password)),
            bool(re.search(r"[\d\W_]", password)),
        ]
    )
    level = "weak" if score <= 2 else ("fair" if score == 3 else "strong")
    return {"score": score, "level": level}


async def create_refresh_token(
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    db: AsyncSession,
    settings: Settings,
) -> str:
    """Create an opaque refresh token, store its hash, return the raw token."""
    from app.models.refresh_token import RefreshToken

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    row = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(row)
    await db.flush()
    return raw_token


async def use_refresh_token(
    raw_token: str,
    db: AsyncSession,
) -> tuple[User, uuid.UUID] | None:
    """Consume a refresh token. Returns (user, family_id) or None.

    If the token is already revoked (replay attack), revokes the entire
    family and returns None.
    """
    from app.models.refresh_token import RefreshToken

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    row = result.scalar_one_or_none()

    if row is None:
        return None

    if row.revoked:
        # Reuse detected: revoke entire family
        await db.execute(
            update(RefreshToken).where(RefreshToken.family_id == row.family_id).values(revoked=True)
        )
        await db.flush()
        return None

    if row.expires_at <= datetime.now(UTC):
        return None

    # Mark as used (revoked)
    row.revoked = True
    await db.flush()

    # Look up the user
    user_result = await db.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return None

    return user, row.family_id


async def revoke_refresh_token(
    raw_token: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Revoke a specific refresh token. Returns True if found and owned by user."""
    from app.models.refresh_token import RefreshToken

    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    row.revoked = True
    await db.flush()
    return True


def create_token(
    user_id: uuid.UUID,
    token_type: str,
    settings: Settings,
    *,
    is_admin: bool = False,
) -> str:
    now = datetime.now(UTC)
    if token_type == "access":  # nosec B105
        expires = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    else:
        expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    claims: dict[str, object] = {
        "sub": str(user_id),
        "type": token_type,
        "exp": expires,
        "iat": now,
    }
    if token_type == "access" and is_admin:  # nosec B105
        claims["is_admin"] = True
    result: str = jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return result


def decode_token(token: str, settings: Settings) -> dict:  # type: ignore[type-arg]
    result: dict = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])  # type: ignore[assignment]
    return result


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    try:
        payload = decode_token(credentials.credentials, settings)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
            )
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
