"""Make user email unique (partial index, NULLs ignored).

Revision ID: 012_unique_email
Revises: 011_app_settings
Create Date: 2026-06-10 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "012_unique_email"
down_revision: str | None = "011_app_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop the old non-unique index, replace with a partial UNIQUE index.
    op.drop_index("ix_users_email", table_name="users")
    op.execute(
        "CREATE UNIQUE INDEX ix_users_email "
        "ON users (email) WHERE email IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=False)
