"""Add is_recurring to vendors.

Revision ID: 013_vendor_is_recurring
Revises: 012_unique_email
Create Date: 2026-06-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "013_vendor_is_recurring"
down_revision: str | None = "012_unique_email"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "vendors",
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_vendors_is_recurring", "vendors", ["is_recurring"])


def downgrade() -> None:
    op.drop_index("ix_vendors_is_recurring", table_name="vendors")
    op.drop_column("vendors", "is_recurring")
