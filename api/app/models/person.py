from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Person(Base):
    __tablename__ = "persons"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trees.id", ondelete="CASCADE"), index=True
    )
    encrypted_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tree: Mapped[Tree] = relationship(back_populates="persons")

    source_relationships: Mapped[list[Relationship]] = relationship(
        foreign_keys="Relationship.source_person_id",
        cascade="all, delete-orphan",
    )
    target_relationships: Mapped[list[Relationship]] = relationship(
        foreign_keys="Relationship.target_person_id",
        cascade="all, delete-orphan",
    )
    event_links: Mapped[list[EventPerson]] = relationship(
        cascade="all, delete-orphan",
    )
