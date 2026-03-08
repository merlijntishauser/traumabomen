"""add sibling groups

Revision ID: 4a493b715fd0
Revises: a82f764098b0
Create Date: 2026-03-08 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4a493b715fd0"
down_revision: str | None = "a82f764098b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sibling_groups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tree_id", sa.Uuid(), nullable=False),
        sa.Column("encrypted_data", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tree_id"], ["trees.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sibling_groups_tree_id"), "sibling_groups", ["tree_id"], unique=False)
    op.create_table(
        "sibling_group_persons",
        sa.Column("sibling_group_id", sa.Uuid(), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["person_id"], ["persons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sibling_group_id"], ["sibling_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("sibling_group_id", "person_id"),
    )


def downgrade() -> None:
    op.drop_table("sibling_group_persons")
    op.drop_index(op.f("ix_sibling_groups_tree_id"), table_name="sibling_groups")
    op.drop_table("sibling_groups")
