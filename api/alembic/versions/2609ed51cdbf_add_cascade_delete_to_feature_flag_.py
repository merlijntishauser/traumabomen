"""add cascade delete to feature_flag_users user_id

Revision ID: 2609ed51cdbf
Revises: 21b7d9a76c9d
Create Date: 2026-03-05 16:27:04.453298

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2609ed51cdbf"
down_revision: str | None = "21b7d9a76c9d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("feature_flag_users_user_id_fkey", "feature_flag_users", type_="foreignkey")
    op.create_foreign_key(
        "feature_flag_users_user_id_fkey",
        "feature_flag_users",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("feature_flag_users_user_id_fkey", "feature_flag_users", type_="foreignkey")
    op.create_foreign_key(
        "feature_flag_users_user_id_fkey",
        "feature_flag_users",
        "users",
        ["user_id"],
        ["id"],
    )
