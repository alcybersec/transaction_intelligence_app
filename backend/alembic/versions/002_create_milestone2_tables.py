"""Create Milestone 2 tables: parsing, vendors, transactions, merge engine.

Revision ID: 002_milestone2
Revises: 001_messages
Create Date: 2024-01-20 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_milestone2"
down_revision: str | None = "001_messages"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Define enum types
instrumenttype = postgresql.ENUM("card", "account", name="instrumenttype", create_type=False)
transactiondirection = postgresql.ENUM("debit", "credit", name="transactiondirection", create_type=False)
transactionstatus = postgresql.ENUM(
    "posted", "reversed", "refunded", "unknown", name="transactionstatus", create_type=False
)
evidencerole = postgresql.ENUM("primary", "secondary", name="evidencerole", create_type=False)


def upgrade() -> None:
    # Create enum types
    instrumenttype.create(op.get_bind(), checkfirst=True)
    transactiondirection.create(op.get_bind(), checkfirst=True)
    transactionstatus.create(op.get_bind(), checkfirst=True)
    evidencerole.create(op.get_bind(), checkfirst=True)

    # 1. Create institutions table
    op.create_table(
        "institutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column(
            "sms_sender_patterns",
            sa.Text(),
            nullable=True,
            comment="JSON array of sender patterns to match",
        ),
        sa.Column(
            "email_sender_patterns",
            sa.Text(),
            nullable=True,
            comment="JSON array of email sender patterns",
        ),
        sa.Column(
            "parse_mode",
            sa.String(50),
            nullable=False,
            server_default="regex",
            comment="Default parsing mode: regex, ollama, hybrid",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 2. Create instruments table
    op.create_table(
        "instruments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "institution_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("institutions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", instrumenttype, nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("last4", sa.String(4), nullable=True, comment="Last 4 digits of card number"),
        sa.Column("account_tail", sa.String(20), nullable=True, comment="Account number tail"),
        sa.Column(
            "raw_identifier_encrypted",
            sa.LargeBinary(),
            nullable=True,
            comment="Full card/account number encrypted",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_instruments_institution", "instruments", ["institution_id"])
    op.create_index("ix_instruments_last4", "instruments", ["last4"])
    op.create_index("ix_instruments_account_tail", "instruments", ["account_tail"])

    # 3. Create wallets table
    op.create_table(
        "wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "combined_balance_last",
            sa.Numeric(15, 2),
            nullable=True,
            comment="Last known combined balance/limit",
        ),
        sa.Column("currency", sa.String(3), nullable=False, server_default="AED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 4. Create wallet_instruments junction table
    op.create_table(
        "wallet_instruments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "wallet_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wallets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "instrument_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_wallet_instrument", "wallet_instruments", ["wallet_id", "instrument_id"])
    op.create_index("ix_wallet_instruments_wallet", "wallet_instruments", ["wallet_id"])
    op.create_index("ix_wallet_instruments_instrument", "wallet_instruments", ["instrument_id"])

    # 5. Create categories table
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("icon", sa.String(50), nullable=True, comment="Icon identifier or emoji"),
        sa.Column("color", sa.String(7), nullable=True, comment="Hex color code"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "is_system",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="System categories cannot be deleted",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_categories_sort_order", "categories", ["sort_order"])

    # 6. Create vendors table
    op.create_table(
        "vendors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column("canonical_name", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 7. Create vendor_aliases table
    op.create_table(
        "vendor_aliases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "alias_raw",
            sa.String(255),
            nullable=False,
            comment="Original raw vendor string from message",
        ),
        sa.Column(
            "alias_normalized",
            sa.String(255),
            nullable=False,
            comment="Normalized form",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_vendor_alias_normalized", "vendor_aliases", ["alias_normalized"])
    op.create_index("ix_vendor_aliases_vendor", "vendor_aliases", ["vendor_id"])
    op.create_index("ix_vendor_aliases_normalized", "vendor_aliases", ["alias_normalized"])

    # 8. Create vendor_category_rules table
    op.create_table(
        "vendor_category_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint(
        "uq_vendor_category_rule", "vendor_category_rules", ["vendor_id", "category_id"]
    )
    op.create_index("ix_vendor_category_rules_vendor", "vendor_category_rules", ["vendor_id"])
    op.create_index("ix_vendor_category_rules_category", "vendor_category_rules", ["category_id"])

    # 9. Create category_suggestions table
    op.create_table(
        "category_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "suggested_category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("model", sa.String(100), nullable=False, comment="AI model used"),
        sa.Column("confidence", sa.Float(), nullable=True, comment="Confidence score 0-1"),
        sa.Column("rationale", sa.Text(), nullable=True, comment="AI explanation"),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="pending, accepted, rejected",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_category_suggestions_vendor", "category_suggestions", ["vendor_id"])
    op.create_index("ix_category_suggestions_status", "category_suggestions", ["status"])

    # 10. Create transaction_groups table
    op.create_table(
        "transaction_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "wallet_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("wallets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "instrument_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="SET NULL"),
            nullable=True,
            comment="Specific instrument if identified",
        ),
        sa.Column("direction", transactiondirection, nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="AED"),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Transaction time from message",
        ),
        sa.Column(
            "observed_at_min",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Earliest observed time across evidence",
        ),
        sa.Column(
            "observed_at_max",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Latest observed time across evidence",
        ),
        sa.Column(
            "vendor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vendors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "vendor_raw",
            sa.String(255),
            nullable=True,
            comment="Original vendor string before normalization",
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "reference_id",
            sa.String(100),
            nullable=True,
            comment="Transaction reference/approval code",
        ),
        sa.Column(
            "combined_balance_after",
            sa.Numeric(15, 2),
            nullable=True,
            comment="Available balance/limit after transaction",
        ),
        sa.Column("status", transactionstatus, nullable=False, server_default="posted"),
        sa.Column(
            "linked_transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("transaction_groups.id", ondelete="SET NULL"),
            nullable=True,
            comment="Reference to original transaction if reversal/refund",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_transaction_groups_wallet", "transaction_groups", ["wallet_id"])
    op.create_index("ix_transaction_groups_occurred_at", "transaction_groups", ["occurred_at"])
    op.create_index("ix_transaction_groups_vendor", "transaction_groups", ["vendor_id"])
    op.create_index("ix_transaction_groups_category", "transaction_groups", ["category_id"])
    op.create_index("ix_transaction_groups_status", "transaction_groups", ["status"])
    op.create_index("ix_transaction_groups_direction", "transaction_groups", ["direction"])
    op.create_index(
        "ix_transaction_groups_merge_match",
        "transaction_groups",
        ["amount", "currency", "direction", "vendor_id"],
    )

    # 11. Create transaction_evidence table
    op.create_table(
        "transaction_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column(
            "transaction_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("transaction_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", evidencerole, nullable=False, server_default="primary"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint(
        "uq_transaction_evidence", "transaction_evidence", ["transaction_group_id", "message_id"]
    )
    op.create_index("ix_transaction_evidence_group", "transaction_evidence", ["transaction_group_id"])
    op.create_index("ix_transaction_evidence_message", "transaction_evidence", ["message_id"])

    # Seed default categories
    op.execute("""
        INSERT INTO categories (id, name, icon, color, sort_order, is_system, created_at, updated_at) VALUES
        (gen_random_uuid(), 'Groceries', 'shopping-cart', '#4CAF50', 1, true, NOW(), NOW()),
        (gen_random_uuid(), 'Dining & Cafes', 'utensils', '#FF9800', 2, true, NOW(), NOW()),
        (gen_random_uuid(), 'Transport', 'car', '#2196F3', 3, true, NOW(), NOW()),
        (gen_random_uuid(), 'Shopping', 'bag', '#9C27B0', 4, true, NOW(), NOW()),
        (gen_random_uuid(), 'Health & Pharmacy', 'heart-pulse', '#E91E63', 5, true, NOW(), NOW()),
        (gen_random_uuid(), 'Bills & Utilities', 'file-text', '#607D8B', 6, true, NOW(), NOW()),
        (gen_random_uuid(), 'Entertainment', 'film', '#FF5722', 7, true, NOW(), NOW()),
        (gen_random_uuid(), 'Travel', 'plane', '#00BCD4', 8, true, NOW(), NOW()),
        (gen_random_uuid(), 'Education', 'graduation-cap', '#3F51B5', 9, true, NOW(), NOW()),
        (gen_random_uuid(), 'Subscriptions', 'refresh-cw', '#795548', 10, true, NOW(), NOW()),
        (gen_random_uuid(), 'Home & Flat', 'home', '#8BC34A', 11, true, NOW(), NOW()),
        (gen_random_uuid(), 'Transfers & Deposits', 'arrow-right-left', '#009688', 12, true, NOW(), NOW()),
        (gen_random_uuid(), 'Fees & Charges', 'percent', '#F44336', 13, true, NOW(), NOW()),
        (gen_random_uuid(), 'Other', 'circle', '#9E9E9E', 99, true, NOW(), NOW())
    """)

    # Seed Mashreq institution
    op.execute("""
        INSERT INTO institutions (id, name, display_name, sms_sender_patterns, email_sender_patterns, parse_mode, is_active, created_at, updated_at) VALUES
        (gen_random_uuid(), 'mashreq', 'Mashreq Bank', '["MASHREQ", "MashreqBank", "MASHREQBANK"]', '["mashreq", "mashreqbank.com"]', 'regex', true, NOW(), NOW())
    """)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("transaction_evidence")
    op.drop_table("transaction_groups")
    op.drop_table("category_suggestions")
    op.drop_table("vendor_category_rules")
    op.drop_table("vendor_aliases")
    op.drop_table("vendors")
    op.drop_table("categories")
    op.drop_table("wallet_instruments")
    op.drop_table("wallets")
    op.drop_table("instruments")
    op.drop_table("institutions")

    # Drop enum types
    evidencerole.drop(op.get_bind(), checkfirst=True)
    transactionstatus.drop(op.get_bind(), checkfirst=True)
    transactiondirection.drop(op.get_bind(), checkfirst=True)
    instrumenttype.drop(op.get_bind(), checkfirst=True)
