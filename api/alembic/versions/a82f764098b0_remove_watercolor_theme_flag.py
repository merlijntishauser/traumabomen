"""remove watercolor_theme flag

Revision ID: a82f764098b0
Revises: c4f70bc3aa25
Create Date: 2026-03-07 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a82f764098b0"
down_revision: str | None = "c4f70bc3aa25"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM feature_flag_users WHERE flag_key = 'watercolor_theme'")
    op.execute("DELETE FROM feature_flags WHERE key = 'watercolor_theme'")


def downgrade() -> None:
    op.execute(
        "INSERT INTO feature_flags (key, audience) VALUES ('watercolor_theme', 'disabled') "
        "ON CONFLICT DO NOTHING"
    )
