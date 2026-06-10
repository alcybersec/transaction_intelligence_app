"""Add is_recurring to transaction_groups.

Revision ID: 007_is_recurring
Revises: 006_chat_tables
Create Date: 2026-06-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007_is_recurring"
down_revision: str | None = "006_chat_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transaction_groups",
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_transaction_groups_is_recurring",
        "transaction_groups",
        ["is_recurring"],
    )


def downgrade() -> None:
    op.drop_index("ix_transaction_groups_is_recurring", table_name="transaction_groups")
    op.drop_column("transaction_groups", "is_recurring")
