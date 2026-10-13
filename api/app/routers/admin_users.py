from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.auth import require_admin
from app.database import get_db
from app.models.user import User
from app.routers.crud_helpers import get_or_404

router = APIRouter(prefix="/admin", tags=["admin"])


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    """Delete an account and everything in it, as the user's own deletion does.

    Admins cannot be deleted here, the acting admin included: removing an
    admin is rare and deliberate, and doing it from a table row would make
    locking everyone out one misclick away.
    """
    user = await get_or_404(db, select(User).where(User.id == user_id), detail="User not found")
    if user.id == admin.id or user.is_admin:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="cannot_delete_admin")
    await db.delete(user)
    await db.commit()
