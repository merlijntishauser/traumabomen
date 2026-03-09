"""add passphrase hint to users

Revision ID: b8879465ace5
Revises: 4a493b715fd0
Create Date: 2026-03-09 19:21:48.622578

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8879465ace5"
down_revision: str | None = "4a493b715fd0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("passphrase_hint", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "passphrase_hint")
