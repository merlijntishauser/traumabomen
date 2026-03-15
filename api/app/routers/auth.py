import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    check_password_strength,
    create_refresh_token,
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.capacity import is_registration_open
from app.config import Settings, get_settings
from app.database import get_db
from app.email import send_email_background, send_password_reset_email, send_verification_email
from app.models.login_event import LoginEvent
from app.models.user import User
from app.models.waitlist import WaitlistEntry, WaitlistStatus
from app.rate_limiter import check_and_tarpit, check_endpoint_rate_limit, clear, record_failure
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    SaltResponse,
    TokenResponse,
    UpdateHintRequest,
    UpdateSaltRequest,
    VerifyResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFICATION_TOKEN_EXPIRY_HOURS = 24
PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1
RESEND_RATE_LIMIT_PER_HOUR = 3


async def _build_token_response(user: User, settings: Settings, db: AsyncSession) -> TokenResponse:
    import uuid as _uuid

    family_id = _uuid.uuid4()
    refresh_plaintext = await create_refresh_token(user.id, family_id, db, settings)
    await db.commit()
    return TokenResponse(
        access_token=create_token(user.id, "access", settings, is_admin=user.is_admin),
        refresh_token=refresh_plaintext,
        encryption_salt=user.encryption_salt,
        onboarding_safety_acknowledged=user.onboarding_safety_acknowledged,
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


async def _validate_invite_token(token: str, email: str, db: AsyncSession) -> WaitlistEntry:
    """Validate an invite token and return the matching waitlist entry."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.invite_token == token_hash,
            WaitlistEntry.status == WaitlistStatus.approved.value,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_or_expired_invite",
        )
    if entry.invite_expires_at and entry.invite_expires_at <= datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_or_expired_invite",
        )
    if entry.email != email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invite_email_mismatch",
        )
    return entry


async def _finalize_registration(
    user: User, waitlist_entry: WaitlistEntry | None, db: AsyncSession
) -> None:
    db.add(user)
    if waitlist_entry:
        waitlist_entry.status = WaitlistStatus.registered.value
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        ) from None


def _validate_password(password: str) -> None:
    if len(password) > 64:
        raise HTTPException(status_code=422, detail="password_too_long")
    if check_password_strength(password)["level"] == "weak":
        raise HTTPException(status_code=422, detail="password_too_weak")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse | RegisterResponse:
    _validate_password(body.password)

    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    waitlist_entry: WaitlistEntry | None = None
    if body.invite_token:
        waitlist_entry = await _validate_invite_token(body.invite_token, email, db)
    elif not await is_registration_open(db, settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="registration_closed",
        )

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        encryption_salt=body.encryption_salt,
        email_verified=not settings.REQUIRE_EMAIL_VERIFICATION,
        passphrase_hint=body.passphrase_hint,
    )

    if settings.REQUIRE_EMAIL_VERIFICATION:
        token, hashed = _generate_verification_token()
        user.email_verification_token = hashed
        user.email_verification_expires_at = datetime.now(UTC) + timedelta(
            hours=VERIFICATION_TOKEN_EXPIRY_HOURS
        )
        await _finalize_registration(user, waitlist_entry, db)
        send_email_background(send_verification_email, email, token, settings, body.language)
        return RegisterResponse(message="verification_email_sent")

    await _finalize_registration(user, waitlist_entry, db)
    await db.refresh(user)
    return await _build_token_response(user, settings, db)


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    ip = request.client.host if request.client else "unknown"
    email = body.email.strip().lower()

    await check_and_tarpit(ip, email)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        record_failure(ip, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    clear(ip, email)

    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="email_not_verified")

    db.add(LoginEvent(user_id=user.id))
    await db.commit()

    return await _build_token_response(user, settings, db)


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


def _was_token_generated_recently(user: User) -> bool:
    """True if the verification token was generated less than 1 hour ago."""
    if not user.email_verification_expires_at:
        return False
    min_expiry = datetime.now(UTC) + timedelta(hours=VERIFICATION_TOKEN_EXPIRY_HOURS - 1)
    return user.email_verification_expires_at > min_expiry


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

    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always return success to avoid email enumeration
    if user is None or user.email_verified:
        return RegisterResponse(message="verification_email_sent")

    if _was_token_generated_recently(user):
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

    send_email_background(send_verification_email, user.email, token, settings, body.language)
    return RegisterResponse(message="verification_email_sent")


def _should_skip_password_reset(user: User) -> bool:
    """Return True if we should silently return without generating a token."""
    if not user.email_verified:
        return True
    if not user.password_reset_expires_at:
        return False
    min_expiry = datetime.now(UTC) + timedelta(hours=PASSWORD_RESET_TOKEN_EXPIRY_HOURS - 1)
    return user.password_reset_expires_at > min_expiry


@router.post("/forgot-password", response_model=VerifyResponse)
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> VerifyResponse:
    ip = request.client.host if request.client else "unknown"
    check_endpoint_rate_limit(ip, "forgot-password")

    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user is None or _should_skip_password_reset(user):
        return VerifyResponse(message="password_reset_email_sent")

    token, hashed = _generate_verification_token()
    user.password_reset_token = hashed
    user.password_reset_expires_at = datetime.now(UTC) + timedelta(
        hours=PASSWORD_RESET_TOKEN_EXPIRY_HOURS
    )
    await db.commit()

    send_email_background(send_password_reset_email, email, token, settings, body.language)
    return VerifyResponse(message="password_reset_email_sent")


@router.post("/reset-password", response_model=VerifyResponse)
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyResponse:
    ip = request.client.host if request.client else "unknown"
    check_endpoint_rate_limit(ip, "reset-password")

    _validate_password(body.new_password)

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    result = await db.execute(select(User).where(User.password_reset_token == token_hash))
    user = result.scalar_one_or_none()

    if user is None or (
        user.password_reset_expires_at and user.password_reset_expires_at <= datetime.now(UTC)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_or_expired_token",
        )

    user.hashed_password = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    await db.commit()

    return VerifyResponse(message="password_reset_complete")


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RefreshResponse:
    from app.auth import use_refresh_token

    result = await use_refresh_token(body.refresh_token, db)
    if result is None:
        await db.commit()  # persist any family revocation from replay detection
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    user, family_id = result
    new_refresh = await create_refresh_token(user.id, family_id, db, settings)
    await db.commit()

    return RefreshResponse(
        access_token=create_token(user.id, "access", settings, is_admin=user.is_admin),
        refresh_token=new_refresh,
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: Request,
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    from app.auth import revoke_refresh_token

    ip = request.client.host if request.client else "unknown"
    check_endpoint_rate_limit(ip, "logout")
    await revoke_refresh_token(body.refresh_token, user.id, db)
    await db.commit()
    return {"message": "Logged out"}


@router.put("/onboarding", status_code=status.HTTP_200_OK)
async def acknowledge_onboarding(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    user.onboarding_safety_acknowledged = True
    await db.commit()
    return {"message": "Onboarding acknowledged"}


@router.get("/salt", response_model=SaltResponse)
async def get_salt(
    user: User = Depends(get_current_user),
) -> SaltResponse:
    return SaltResponse(
        encryption_salt=user.encryption_salt,
        passphrase_hint=user.passphrase_hint,
    )


@router.put("/password", status_code=status.HTTP_200_OK)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect"
        )
    _validate_password(body.new_password)
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password changed"}


@router.put("/salt", status_code=status.HTTP_200_OK)
async def update_salt(
    body: UpdateSaltRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    user.encryption_salt = body.encryption_salt
    await db.commit()
    return {"message": "Salt updated"}


@router.put("/hint", status_code=status.HTTP_200_OK)
async def update_hint(
    body: UpdateHintRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if body.passphrase_hint is not None and len(body.passphrase_hint) > 255:
        raise HTTPException(status_code=422, detail="Hint too long (max 255 characters)")
    user.passphrase_hint = body.passphrase_hint
    await db.commit()
    return {"message": "Hint updated"}


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    body: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect"
        )
    await db.delete(user)
    await db.commit()
