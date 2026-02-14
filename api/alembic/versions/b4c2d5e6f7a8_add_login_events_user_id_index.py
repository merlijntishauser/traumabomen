"""add login_events user_id index

Revision ID: b4c2d5e6f7a8
Revises: a3b1c2d4e5f6
Create Date: 2026-02-14 19:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b4c2d5e6f7a8"
down_revision: str | None = "a3b1c2d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(op.f("ix_login_events_user_id"), "login_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_login_events_user_id"), table_name="login_events")
