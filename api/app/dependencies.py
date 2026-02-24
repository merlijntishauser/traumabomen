import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.tree import Tree
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
