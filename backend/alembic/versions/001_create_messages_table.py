"""Create messages table for SMS and email ingestion.

Revision ID: 001_messages
Revises:
Create Date: 2024-01-15 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_messages"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Define enum types using postgresql.ENUM
messagesource = postgresql.ENUM("sms", "email", name="messagesource", create_type=False)
parsestatus = postgresql.ENUM(
    "pending", "success", "failed", "needs_review", name="parsestatus", create_type=False
)
parsemode = postgresql.ENUM("regex", "ollama", "hybrid", name="parsemode", create_type=False)


def upgrade() -> None:
    # Create enum types first
    messagesource.create(op.get_bind(), checkfirst=True)
    parsestatus.create(op.get_bind(), checkfirst=True)
    parsemode.create(op.get_bind(), checkfirst=True)

    # Create messages table
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("source", messagesource, nullable=False),
        sa.Column("source_uid", sa.String(255), nullable=False),
        sa.Column(
            "observed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="When message was received on phone/email (IMAP INTERNALDATE)",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sender", sa.String(255), nullable=False),
        sa.Column(
            "raw_body_encrypted",
            sa.LargeBinary(),
            nullable=False,
            comment="Fernet-encrypted raw message body",
        ),
        sa.Column(
            "raw_body_hash",
            sa.String(64),
            nullable=False,
            comment="SHA-256 hash for deduplication",
        ),
        sa.Column(
            "device_id",
            sa.String(255),
            nullable=True,
            comment="Device identifier for SMS sources",
        ),
        sa.Column("parse_status", parsestatus, nullable=False, server_default="pending"),
        sa.Column(
            "parse_mode",
            parsemode,
            nullable=True,
            comment="Which parsing method was used",
        ),
        sa.Column(
            "parse_error",
            sa.Text(),
            nullable=True,
            comment="Error message if parsing failed",
        ),
    )

    # Create indexes
    op.create_index("ix_messages_source", "messages", ["source"])
    op.create_index("ix_messages_observed_at", "messages", ["observed_at"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_messages_sender", "messages", ["sender"])
    op.create_index("ix_messages_raw_body_hash", "messages", ["raw_body_hash"])
    op.create_index("ix_messages_device_id", "messages", ["device_id"])
    op.create_index("ix_messages_parse_status", "messages", ["parse_status"])

    # Create composite indexes
    op.create_index("ix_messages_hash_observed", "messages", ["raw_body_hash", "observed_at"])
    op.create_index("ix_messages_source_observed", "messages", ["source", "observed_at"])

    # Create unique constraint for idempotency
    op.create_unique_constraint("uq_messages_source_uid", "messages", ["source", "source_uid"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_messages_source_observed", table_name="messages")
    op.drop_index("ix_messages_hash_observed", table_name="messages")
    op.drop_index("ix_messages_parse_status", table_name="messages")
    op.drop_index("ix_messages_device_id", table_name="messages")
    op.drop_index("ix_messages_raw_body_hash", table_name="messages")
    op.drop_index("ix_messages_sender", table_name="messages")
    op.drop_index("ix_messages_created_at", table_name="messages")
    op.drop_index("ix_messages_observed_at", table_name="messages")
    op.drop_index("ix_messages_source", table_name="messages")

    # Drop unique constraint
    op.drop_constraint("uq_messages_source_uid", "messages", type_="unique")

    # Drop table
    op.drop_table("messages")

    # Drop enum types
    parsemode.drop(op.get_bind(), checkfirst=True)
    parsestatus.drop(op.get_bind(), checkfirst=True)
    messagesource.drop(op.get_bind(), checkfirst=True)
