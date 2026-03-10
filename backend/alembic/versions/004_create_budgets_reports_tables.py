"""Create budgets and reports tables for Milestone 5.

Revision ID: 004_budgets_reports
Revises: 003_users
Create Date: 2024-01-28 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_budgets_reports"
down_revision: str | None = "003_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Define enum types
reportgeneratedby = postgresql.ENUM(
    "manual", "scheduled", name="reportgeneratedby", create_type=False
)


def upgrade() -> None:
    # Create enum types
    reportgeneratedby.create(op.get_bind(), checkfirst=True)

    # 1. Create budgets table
    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "wallet_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wallets.id", ondelete="CASCADE"),
            nullable=True,
            comment="Optional wallet scope; null means all wallets",
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "month",
            sa.Date(),
            nullable=False,
            comment="First day of the budget month (e.g., 2024-01-01)",
        ),
        sa.Column(
            "limit_amount",
            sa.Numeric(15, 2),
            nullable=False,
            comment="Budget limit for this category/month",
        ),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="AED",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint(
        "uq_budget_wallet_category_month",
        "budgets",
        ["wallet_id", "category_id", "month"],
    )
    op.create_index("ix_budgets_wallet", "budgets", ["wallet_id"])
    op.create_index("ix_budgets_category", "budgets", ["category_id"])
    op.create_index("ix_budgets_month", "budgets", ["month"])

    # 2. Create reports table
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "wallet_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wallets.id", ondelete="SET NULL"),
            nullable=True,
            comment="Optional wallet scope; null means all wallets",
        ),
        sa.Column(
            "period_start",
            sa.Date(),
            nullable=False,
            comment="Report period start date",
        ),
        sa.Column(
            "period_end",
            sa.Date(),
            nullable=False,
            comment="Report period end date",
        ),
        sa.Column(
            "report_markdown",
            sa.Text(),
            nullable=True,
            comment="Report content in markdown format",
        ),
        sa.Column(
            "report_pdf_blob",
            sa.LargeBinary(),
            nullable=True,
            comment="Generated PDF binary",
        ),
        sa.Column(
            "generated_by",
            reportgeneratedby,
            nullable=False,
            server_default="manual",
        ),
        sa.Column(
            "ai_model",
            sa.String(100),
            nullable=True,
            comment="AI model used if AI-generated (Milestone 6)",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reports_wallet", "reports", ["wallet_id"])
    op.create_index("ix_reports_period", "reports", ["period_start", "period_end"])
    op.create_index("ix_reports_created", "reports", ["created_at"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("reports")
    op.drop_table("budgets")

    # Drop enum types
    reportgeneratedby.drop(op.get_bind(), checkfirst=True)
