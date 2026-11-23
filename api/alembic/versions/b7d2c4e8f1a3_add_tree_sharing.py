"""add tree sharing

Revision ID: b7d2c4e8f1a3
Revises: 9e3f1b7c5a2d
Create Date: 2026-11-23 22:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d2c4e8f1a3"
down_revision: str | None = "9e3f1b7c5a2d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("public_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("encrypted_private_key", sa.Text(), nullable=True))

    op.create_table(
        "tree_shares",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tree_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=True),
        sa.Column("encrypted_tree_key", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["tree_id"], ["trees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tree_id", "recipient_email", name="uq_tree_shares_tree_recipient"),
    )
    op.create_index("ix_tree_shares_recipient_id", "tree_shares", ["recipient_id"])
    op.create_index("ix_tree_shares_recipient_email", "tree_shares", ["recipient_email"])

    op.execute("INSERT INTO feature_flags (key, audience) VALUES ('tree_sharing', 'disabled')")


def downgrade() -> None:
    op.execute("DELETE FROM feature_flag_users WHERE flag_key = 'tree_sharing'")
    op.execute("DELETE FROM feature_flags WHERE key = 'tree_sharing'")
    op.drop_index("ix_tree_shares_recipient_email", table_name="tree_shares")
    op.drop_index("ix_tree_shares_recipient_id", table_name="tree_shares")
    op.drop_table("tree_shares")
    op.drop_column("users", "encrypted_private_key")
    op.drop_column("users", "public_key")
    op.drop_column("users", "display_name")
