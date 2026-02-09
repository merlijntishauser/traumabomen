import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.tree import Tree
from app.models.user import User


async def get_owned_tree(
    tree_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tree:
    result = await db.execute(
        select(Tree).where(Tree.id == tree_id, Tree.user_id == user.id)
    )
    tree = result.scalar_one_or_none()
    if tree is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tree not found")
    return tree
