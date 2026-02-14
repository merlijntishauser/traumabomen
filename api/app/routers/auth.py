import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_token, decode_token, get_current_user, hash_password, verify_password
from app.config import Settings, get_settings
from app.database import get_db
from app.email import send_verification_email
from app.models.login_event import LoginEvent
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    SaltResponse,
    TokenResponse,
    VerifyResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFICATION_TOKEN_EXPIRY_HOURS = 24
RESEND_RATE_LIMIT_PER_HOUR = 3


def _build_token_response(user: User, settings: Settings) -> TokenResponse:
    return TokenResponse(
        access_token=create_token(user.id, "access", settings, is_admin=user.is_admin),
        refresh_token=create_token(user.id, "refresh", settings),
        encryption_salt=user.encryption_salt,
    )


def _generate_verification_token() -> tuple[str, str]:
    """Return (plaintext_token, sha256_hex_hash).

    Uses SHA-256 instead of bcrypt so the token can be looked up directly
    by hash rather than scanning all unverified users. SHA-256 is secure
    for random 256-bit tokens (no brute-force resistance needed).
    """
    token = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(token.encode()).hexdigest()
    return token, hashed


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse | RegisterResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if settings.REQUIRE_EMAIL_VERIFICATION:
        token, hashed = _generate_verification_token()
        user = User(
            email=body.email,
            hashed_password=hash_password(body.password),
            encryption_salt=body.encryption_salt,
            email_verified=False,
            email_verification_token=hashed,
            email_verification_expires_at=datetime.now(UTC)
            + timedelta(hours=VERIFICATION_TOKEN_EXPIRY_HOURS),
        )
        db.add(user)
        await db.commit()

        send_verification_email(body.email, token, settings)
        return RegisterResponse(message="verification_email_sent")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        encryption_salt=body.encryption_salt,
        email_verified=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _build_token_response(user, settings)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="email_not_verified")

    db.add(LoginEvent(user_id=user.id))
    await db.commit()

    return _build_token_response(user, settings)


@router.get("/verify", response_model=VerifyResponse)
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> VerifyResponse:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(User).where(
            User.email_verified == False,  # noqa: E712
            User.email_verification_token == token_hash,
        )
    )
    user = result.scalar_one_or_none()

    if user is None or (
        user.email_verification_expires_at
        and user.email_verification_expires_at <= datetime.now(UTC)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_or_expired_token",
        )

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    await db.commit()

    return VerifyResponse(message="email_verified")


@router.post("/resend-verification", response_model=RegisterResponse)
async def resend_verification(
    body: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RegisterResponse:
    if not settings.REQUIRE_EMAIL_VERIFICATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification is not enabled",
        )

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return success to avoid email enumeration
    if user is None or user.email_verified:
        return RegisterResponse(message="verification_email_sent")

    # Rate limit: check if token was generated recently
    if user.email_verification_expires_at and user.email_verification_expires_at > datetime.now(
        UTC
    ) + timedelta(hours=VERIFICATION_TOKEN_EXPIRY_HOURS - 1):
        # Token was generated less than 1 hour ago -- too soon
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="resend_too_soon",
        )

    token, hashed = _generate_verification_token()
    user.email_verification_token = hashed
    user.email_verification_expires_at = datetime.now(UTC) + timedelta(
        hours=VERIFICATION_TOKEN_EXPIRY_HOURS
    )
    await db.commit()

    send_verification_email(user.email, token, settings)
    return RegisterResponse(message="verification_email_sent")


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RefreshResponse:
    try:
        payload = decode_token(body.refresh_token, settings)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )
    return RefreshResponse(
        access_token=create_token(user_id, "access", settings, is_admin=user.is_admin),
    )


@router.get("/salt", response_model=SaltResponse)
async def get_salt(
    user: User = Depends(get_current_user),
) -> SaltResponse:
    return SaltResponse(encryption_salt=user.encryption_salt)
