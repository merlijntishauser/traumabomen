from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

SHARE_PENDING = "pending"
SHARE_ACTIVE = "active"


class TreeShare(Base):
    """A read-only grant of one tree to one recipient, identified by email.

    The row is created pending (recipient_id and encrypted_tree_key filled in
    once the recipient has a key pair) and becomes active when the owner has
    wrapped the tree key for the recipient. Revoking deletes the row.
    """

    __tablename__ = "tree_shares"
    __table_args__ = (
        UniqueConstraint("tree_id", "recipient_email", name="uq_tree_shares_tree_recipient"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trees.id", ondelete="CASCADE"))
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    recipient_email: Mapped[str] = mapped_column(String(255), index=True)
    recipient_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True
    )
    encrypted_tree_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), default=SHARE_PENDING, server_default=SHARE_PENDING
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tree: Mapped[Tree] = relationship(back_populates="shares")
