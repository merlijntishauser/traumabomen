import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.tree import Tree
from app.models.tree_share import TreeShare
from app.models.user import User
from app.routers.crud_helpers import get_or_404


async def get_owned_tree(
    tree_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tree:
    return await get_or_404(
        db,
        select(Tree).where(Tree.id == tree_id, Tree.user_id == user.id),
        detail="Tree not found",
    )


async def get_readable_tree(
    tree_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tree:
    """Return the tree for its owner or for a recipient with an active share.

    Read-only: use only on GET routes. A pending share grants nothing. The 404
    detail matches get_owned_tree so a non-owner cannot probe for existence.
    """
    active_share = (
        select(TreeShare.id)
        .where(
            TreeShare.tree_id == Tree.id,
            TreeShare.recipient_id == user.id,
            TreeShare.status == "active",
        )
        .exists()
    )
    return await get_or_404(
        db,
        select(Tree).where(Tree.id == tree_id, (Tree.user_id == user.id) | active_share),
        detail="Tree not found",
    )
