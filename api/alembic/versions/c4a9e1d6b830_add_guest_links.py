"""add guest links

Revision ID: c4a9e1d6b830
Revises: b7d2c4e8f1a3
Create Date: 2026-11-26 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4a9e1d6b830"
down_revision: str | None = "b7d2c4e8f1a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "guest_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tree_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("link_id", sa.String(length=22), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("ciphertext", sa.Text(), nullable=False),
        sa.Column("owner_blob", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("failed_streak", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("open_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tree_id"], ["trees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("link_id", name="uq_guest_links_link_id"),
    )
    op.create_index("ix_guest_links_tree_id", "guest_links", ["tree_id"])
    op.create_index("ix_guest_links_owner_id", "guest_links", ["owner_id"])

    op.create_table(
        "guest_link_networks",
        sa.Column("guest_link_id", sa.Uuid(), nullable=False),
        sa.Column("network_hash", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["guest_link_id"], ["guest_links.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("guest_link_id", "network_hash"),
    )

    op.execute("INSERT INTO feature_flags (key, audience) VALUES ('guest_links', 'disabled')")


def downgrade() -> None:
    op.execute("DELETE FROM feature_flag_users WHERE flag_key = 'guest_links'")
    op.execute("DELETE FROM feature_flags WHERE key = 'guest_links'")
    op.drop_table("guest_link_networks")
    op.drop_index("ix_guest_links_owner_id", table_name="guest_links")
    op.drop_index("ix_guest_links_tree_id", table_name="guest_links")
    op.drop_table("guest_links")
