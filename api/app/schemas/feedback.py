from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    category: Literal["bug", "feature", "general"]
    message: str = Field(min_length=1, max_length=2000)
    anonymous: bool = False


class FeedbackResponse(BaseModel):
    id: str
    category: str
    message: str
    user_email: str | None
    created_at: datetime
    is_read: bool


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
