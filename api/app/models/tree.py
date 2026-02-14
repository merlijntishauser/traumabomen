from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tree(Base):
    __tablename__ = "trees"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    encrypted_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    persons: Mapped[list[Person]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )
    relationships: Mapped[list[Relationship]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )
    events: Mapped[list[TraumaEvent]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )
    life_events: Mapped[list[LifeEvent]] = relationship(
        back_populates="tree", cascade="all, delete-orphan"
    )
