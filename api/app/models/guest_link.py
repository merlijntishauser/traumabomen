from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.database import Base
from app.models.tree import Tree  # noqa: F401  (resolves the relationship annotation)

MAX_LIVE_LINKS_PER_TREE = 5
LOCK_THRESHOLD = 10
MAX_NETWORKS = 100
EXPIRY_DAY_CHOICES = (1, 7, 14, 30)
# Base64 of 5 MB of ciphertext plus JSON framing.
MAX_CIPHERTEXT_CHARS = 7_000_000
MAX_OWNER_BLOB_CHARS = 4096


class GuestLink(Base):
    """An encrypted read-only copy of a tree, opened with a link and a passphrase.

    The server holds only ciphertext, the SHA-256 of the auth token (hex) and
    counters. link_id is the unpadded base64url of the 16-byte derived id.
    """

    __tablename__ = "guest_links"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tree_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trees.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    link_id: Mapped[str] = mapped_column(String(22), unique=True)
    token_hash: Mapped[str] = mapped_column(String(64))
    ciphertext: Mapped[str] = deferred(mapped_column(Text))
    owner_blob: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    failed_streak: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    failed_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    open_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tree: Mapped[Tree] = relationship(back_populates="guest_links")
    networks: Mapped[list[GuestLinkNetwork]] = relationship(
        back_populates="guest_link", cascade="all, delete-orphan"
    )


class GuestLinkNetwork(Base):
    """A hashed network address that opened a link, for the owner's distinct count."""

    __tablename__ = "guest_link_networks"

    guest_link_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("guest_links.id", ondelete="CASCADE"), primary_key=True
    )
    network_hash: Mapped[str] = mapped_column(String(64), primary_key=True)

    guest_link: Mapped[GuestLink] = relationship(back_populates="networks")
