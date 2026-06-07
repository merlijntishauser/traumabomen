from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FAQEntry(Base):
    """Admin-authored public FAQ entry (bilingual).

    This is public marketing content, not user data, so it is stored
    unencrypted (unlike the encrypted tree data).
    """

    __tablename__ = "faq_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    question_en: Mapped[str] = mapped_column(Text)
    answer_en: Mapped[str] = mapped_column(Text)
    question_nl: Mapped[str] = mapped_column(Text)
    answer_nl: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    published: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
