from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.auth import require_admin
from app.database import get_db
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackListResponse, FeedbackResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/feedback", response_model=FeedbackListResponse)
async def admin_feedback(db: AsyncSession = Depends(get_db)) -> FeedbackListResponse:
    result = await db.execute(
        select(
            Feedback.id,
            Feedback.category,
            Feedback.message,
            Feedback.created_at,
            Feedback.is_read,
            User.email,
        )
        .outerjoin(User, Feedback.user_id == User.id)
        .order_by(Feedback.created_at.desc())
    )

    items = [
        FeedbackResponse(
            id=str(row.id),
            category=row.category,
            message=row.message,
            user_email=row.email,
            created_at=row.created_at,
            is_read=row.is_read,
        )
        for row in result.all()
    ]

    return FeedbackListResponse(items=items)


@router.patch("/feedback/{feedback_id}/read", response_model=FeedbackResponse)
async def mark_feedback_read(
    feedback_id: UUID, db: AsyncSession = Depends(get_db)
) -> FeedbackResponse:
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")

    feedback.is_read = True
    await db.commit()
    await db.refresh(feedback)

    # Get user email
    user_email: str | None = None
    if feedback.user_id is not None:
        user_result = await db.execute(select(User.email).where(User.id == feedback.user_id))
        user_row = user_result.scalar_one_or_none()
        user_email = user_row

    return FeedbackResponse(
        id=str(feedback.id),
        category=feedback.category,
        message=feedback.message,
        user_email=user_email,
        created_at=feedback.created_at,
        is_read=feedback.is_read,
    )


@router.delete("/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(feedback_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")

    await db.delete(feedback)
    await db.commit()
