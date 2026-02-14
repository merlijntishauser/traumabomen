"""add admin dashboard tables

Revision ID: a3b1c2d4e5f6
Revises: f91fedfe752f
Create Date: 2026-02-14 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3b1c2d4e5f6"
down_revision: str | None = "f91fedfe752f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False)
    )
    op.create_table(
        "login_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "logged_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_login_events_logged_at"), "login_events", ["logged_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_login_events_logged_at"), table_name="login_events")
    op.drop_table("login_events")
    op.drop_column("users", "is_admin")
