"""Transaction models for canonical transaction groups and evidence linking."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class TransactionDirection(str, enum.Enum):
    """Direction of money flow."""

    DEBIT = "debit"
    CREDIT = "credit"


class TransactionStatus(str, enum.Enum):
    """Status of the transaction."""

    POSTED = "posted"
    REVERSED = "reversed"
    REFUNDED = "refunded"
    UNKNOWN = "unknown"


class EvidenceRole(str, enum.Enum):
    """Role of evidence in a transaction group."""

    PRIMARY = "primary"
    SECONDARY = "secondary"


class TransactionGroup(Base):
    """
    Canonical transaction (merged view).

    Represents a single transaction that may have multiple evidence sources
    (e.g., both SMS and email for the same purchase).
    """

    __tablename__ = "transaction_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Wallet context
    wallet_id = Column(
        UUID(as_uuid=True),
        ForeignKey("wallets.id", ondelete="SET NULL"),
        nullable=True,
    )
    instrument_id = Column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="SET NULL"),
        nullable=True,
        comment="Specific instrument if identified",
    )

    # Transaction details
    direction = Column(
        Enum(TransactionDirection, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="AED")

    # Timestamps
    occurred_at = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Transaction time from message",
    )
    observed_at_min = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Earliest observed time across evidence",
    )
    observed_at_max = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="Latest observed time across evidence",
    )

    # Vendor
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="SET NULL"),
        nullable=True,
    )
    vendor_raw = Column(
        String(255),
        nullable=True,
        comment="Original vendor string before normalization",
    )

    # Category (resolved from vendor rules or AI)
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Optional fields
    reference_id = Column(
        String(100),
        nullable=True,
        comment="Transaction reference/approval code",
    )
    combined_balance_after = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Available balance/limit after transaction",
    )

    # Status
    status = Column(
        Enum(TransactionStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=TransactionStatus.POSTED,
    )

    # Reversal/refund linking
    linked_transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transaction_groups.id", ondelete="SET NULL"),
        nullable=True,
        comment="Reference to original transaction if this is reversal/refund",
    )

    # User notes (editable)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    wallet = relationship("Wallet", back_populates="transaction_groups")
    instrument = relationship("Instrument")
    vendor = relationship("Vendor", back_populates="transaction_groups")
    category = relationship("Category")
    evidence = relationship(
        "TransactionEvidence",
        back_populates="transaction_group",
        cascade="all, delete-orphan",
    )
    linked_transaction = relationship("TransactionGroup", remote_side=[id])

    __table_args__ = (
        Index("ix_transaction_groups_wallet", "wallet_id"),
        Index("ix_transaction_groups_occurred_at", "occurred_at"),
        Index("ix_transaction_groups_vendor", "vendor_id"),
        Index("ix_transaction_groups_category", "category_id"),
        Index("ix_transaction_groups_status", "status"),
        Index("ix_transaction_groups_direction", "direction"),
        # Composite index for merge matching
        Index(
            "ix_transaction_groups_merge_match",
            "amount",
            "currency",
            "direction",
            "vendor_id",
        ),
    )

    def __repr__(self) -> str:
        return f"<TransactionGroup(id={self.id}, amount={self.amount} {self.currency}, direction={self.direction})>"


class TransactionEvidence(Base):
    """
    Links messages to transaction groups.

    Each transaction group can have multiple evidence sources.
    """

    __tablename__ = "transaction_evidence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transaction_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
    )

    role = Column(
        Enum(EvidenceRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=EvidenceRole.PRIMARY,
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    transaction_group = relationship("TransactionGroup", back_populates="evidence")
    message = relationship("Message")

    __table_args__ = (
        UniqueConstraint(
            "transaction_group_id", "message_id", name="uq_transaction_evidence"
        ),
        Index("ix_transaction_evidence_group", "transaction_group_id"),
        Index("ix_transaction_evidence_message", "message_id"),
    )

    def __repr__(self) -> str:
        return f"<TransactionEvidence(group_id={self.transaction_group_id}, message_id={self.message_id})>"
