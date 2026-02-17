import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WaitlistStatus(enum.StrEnum):
    waiting = "waiting"
    approved = "approved"
    registered = "registered"


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default=WaitlistStatus.waiting.value)
    invite_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
