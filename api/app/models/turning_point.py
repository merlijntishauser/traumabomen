from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, make_junction_model

TurningPointPerson = make_junction_model(
    "TurningPointPerson", "turning_point_persons", "turning_point_id", "turning_points"
)


class TurningPoint(Base):
    __tablename__ = "turning_points"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trees.id", ondelete="CASCADE"), index=True
    )
    encrypted_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tree: Mapped[Tree] = relationship(back_populates="turning_points")
    person_links: Mapped[list[TurningPointPerson]] = relationship(
        cascade="all, delete-orphan",
    )
