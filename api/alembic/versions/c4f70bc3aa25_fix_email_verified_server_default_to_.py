"""fix email_verified server_default to false

Revision ID: c4f70bc3aa25
Revises: 2609ed51cdbf
Create Date: 2026-03-05 17:21:38.414646

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4f70bc3aa25"
down_revision: str | None = "2609ed51cdbf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "email_verified",
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "email_verified",
        server_default=sa.text("true"),
    )
