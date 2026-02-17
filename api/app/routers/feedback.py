import logging
from threading import Thread

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.database import get_db
from app.email import send_feedback_email
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["feedback"])


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    data: FeedbackCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    user_email: str | None = None if data.anonymous else user.email

    feedback = Feedback(
        user_id=None if data.anonymous else user.id,
        category=data.category,
        message=data.message,
    )
    db.add(feedback)
    await db.commit()

    Thread(
        target=send_feedback_email,
        args=(data.category, data.message, user_email, settings),
        daemon=True,
    ).start()

    return {"id": str(feedback.id)}
