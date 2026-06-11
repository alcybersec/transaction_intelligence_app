"""Allow budgets without a category (overall monthly budget).

Revision ID: 014_budget_category_nullable
Revises: 013_vendor_is_recurring
Create Date: 2026-06-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "014_budget_category_nullable"
down_revision: str | None = "013_vendor_is_recurring"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "budgets",
        "category_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    # Drop the old unique constraint that assumed category_id is non-null
    op.drop_constraint("uq_budget_wallet_category_month", "budgets", type_="unique")
    # Replace with partial unique indexes: one for category-scoped budgets,
    # one for overall (null category) budgets
    op.execute(
        "CREATE UNIQUE INDEX uq_budget_wallet_category_month "
        "ON budgets (wallet_id, category_id, month) "
        "WHERE category_id IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_budget_wallet_overall_month "
        "ON budgets (COALESCE(wallet_id::text, ''), month) "
        "WHERE category_id IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_budget_wallet_overall_month")
    op.execute("DROP INDEX IF EXISTS uq_budget_wallet_category_month")
    # Delete any overall budgets so the NOT NULL constraint can be reinstated
    op.execute("DELETE FROM budgets WHERE category_id IS NULL")
    op.alter_column(
        "budgets",
        "category_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_unique_constraint(
        "uq_budget_wallet_category_month", "budgets", ["wallet_id", "category_id", "month"]
    )
