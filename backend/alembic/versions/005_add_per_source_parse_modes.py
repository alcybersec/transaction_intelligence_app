"""Add per-source parse mode columns to institutions.

Allows different parsing modes for SMS vs email from the same bank.

Revision ID: 005_per_source_parse_modes
Revises: 004_budgets_reports
Create Date: 2024-01-29 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005_per_source_parse_modes"
down_revision: str | None = "004_budgets_reports"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add sms_parse_mode column (defaults to existing parse_mode value)
    op.add_column(
        "institutions",
        sa.Column(
            "sms_parse_mode",
            sa.String(50),
            nullable=True,
            comment="Parse mode for SMS messages: regex, ollama, hybrid. Falls back to parse_mode if null.",
        ),
    )

    # Add email_parse_mode column (defaults to existing parse_mode value)
    op.add_column(
        "institutions",
        sa.Column(
            "email_parse_mode",
            sa.String(50),
            nullable=True,
            comment="Parse mode for email messages: regex, ollama, hybrid. Falls back to parse_mode if null.",
        ),
    )

    # Note: Existing 'parse_mode' column is kept as the default fallback


def downgrade() -> None:
    op.drop_column("institutions", "email_parse_mode")
    op.drop_column("institutions", "sms_parse_mode")
