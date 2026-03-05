import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    audience: Mapped[str] = mapped_column(String(50), default="disabled", server_default="disabled")


class FeatureFlagUser(Base):
    __tablename__ = "feature_flag_users"

    flag_key: Mapped[str] = mapped_column(ForeignKey("feature_flags.key"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
