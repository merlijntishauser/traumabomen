import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_owned_tree
from app.email import send_email_background, send_share_invite_email
from app.models.tree import Tree
from app.models.tree_share import SHARE_ACTIVE, SHARE_PENDING, TreeShare
from app.models.user import User
from app.rate_limiter import check_endpoint_rate_limit, get_client_ip
from app.routers.features import user_has_flag
from app.schemas.shares import (
    CompleteShareRequest,
    CreateShareRequest,
    PendingShareResponse,
    SharedKeyResponse,
    ShareResponse,
)

MAX_PENDING_SHARES = 20

router = APIRouter(prefix="/trees/{tree_id}/shares", tags=["shares"])
auth_router = APIRouter(prefix="/auth", tags=["shares"])


def _to_response(share: TreeShare, recipient: User | None) -> ShareResponse:
    return ShareResponse(
        id=share.id,
        tree_id=share.tree_id,
        recipient_email=share.recipient_email,
        recipient_display_name=recipient.display_name if recipient else None,
        status=share.status,
        created_at=share.created_at,
    )


async def _user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _get_share_or_404(db: AsyncSession, tree: Tree, share_id: uuid.UUID) -> TreeShare:
    result = await db.execute(
        select(TreeShare).where(TreeShare.id == share_id, TreeShare.tree_id == tree.id)
    )
    share = result.scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    return share


@router.get("")
async def list_shares(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[ShareResponse]:
    rows = await db.execute(
        select(TreeShare, User)
        .outerjoin(User, User.email == TreeShare.recipient_email)
        .where(TreeShare.tree_id == tree.id)
        .order_by(TreeShare.created_at)
    )
    return [_to_response(share, recipient) for share, recipient in rows.all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_share(
    body: CreateShareRequest,
    request: Request,
    tree: Tree = Depends(get_owned_tree),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ShareResponse:
    if not await user_has_flag(db, user, "tree_sharing"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="sharing_not_enabled")
    check_endpoint_rate_limit(get_client_ip(request), "tree-share")
    check_endpoint_rate_limit(str(user.id), "tree-share-user")

    email = body.recipient_email.strip().lower()
    if email == user.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="cannot_share_with_self"
        )

    existing = await db.execute(
        select(TreeShare.id).where(TreeShare.tree_id == tree.id, TreeShare.recipient_email == email)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already_shared")

    recipient = await _user_by_email(db, email)
    if recipient is not None and recipient.public_key:
        if not body.encrypted_tree_key:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="encrypted_tree_key_required",
            )
        share = TreeShare(
            tree_id=tree.id,
            owner_id=user.id,
            recipient_email=email,
            recipient_id=recipient.id,
            encrypted_tree_key=body.encrypted_tree_key,
            status=SHARE_ACTIVE,
        )
    else:
        pending_count = await db.scalar(
            select(func.count())
            .select_from(TreeShare)
            .where(TreeShare.owner_id == user.id, TreeShare.status == SHARE_PENDING)
        )
        if (pending_count or 0) >= MAX_PENDING_SHARES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="pending_share_limit")
        share = TreeShare(
            tree_id=tree.id,
            owner_id=user.id,
            recipient_email=email,
            status=SHARE_PENDING,
        )

    db.add(share)
    await db.commit()
    await db.refresh(share)

    if recipient is None:
        send_email_background(send_share_invite_email, email, settings, body.language)
    return _to_response(share, recipient)


@router.put("/{share_id}")
async def complete_share(
    share_id: uuid.UUID,
    body: CompleteShareRequest,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ShareResponse:
    share = await _get_share_or_404(db, tree, share_id)
    if share.status == SHARE_ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already_active")
    recipient = await _user_by_email(db, share.recipient_email)
    if recipient is None or not recipient.public_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="recipient_has_no_key")
    share.encrypted_tree_key = body.encrypted_tree_key
    share.recipient_id = recipient.id
    share.status = SHARE_ACTIVE
    await db.commit()
    await db.refresh(share)
    return _to_response(share, recipient)


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    share_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> Response:
    share = await _get_share_or_404(db, tree, share_id)
    await db.delete(share)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@auth_router.get("/shared-keys")
async def list_shared_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SharedKeyResponse]:
    rows = await db.execute(
        select(TreeShare, User)
        .join(User, User.id == TreeShare.owner_id)
        .where(TreeShare.recipient_id == user.id, TreeShare.status == SHARE_ACTIVE)
        .order_by(TreeShare.created_at)
    )
    return [
        SharedKeyResponse(
            share_id=share.id,
            tree_id=share.tree_id,
            encrypted_tree_key=share.encrypted_tree_key or "",
            owner_display_name=owner.display_name,
            owner_email=owner.email,
        )
        for share, owner in rows.all()
    ]


@auth_router.get("/pending-shares")
async def list_pending_shares(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PendingShareResponse]:
    rows = await db.execute(
        select(TreeShare, User)
        .join(User, User.email == TreeShare.recipient_email)
        .where(
            TreeShare.owner_id == user.id,
            TreeShare.status == SHARE_PENDING,
            User.public_key.is_not(None),
            User.public_key != "",
        )
        .order_by(TreeShare.created_at)
    )
    return [
        PendingShareResponse(
            share_id=share.id,
            tree_id=share.tree_id,
            recipient_email=share.recipient_email,
            recipient_public_key=recipient.public_key or "",
        )
        for share, recipient in rows.all()
    ]
