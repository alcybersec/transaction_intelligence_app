"""Budget model for monthly category spending limits."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Budget(Base):
    """
    Monthly budget per category.

    Allows setting spending limits for categories on a monthly basis.
    Can be scoped to a specific wallet or apply to all wallets (wallet_id=None).
    """

    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Optional wallet scope (null = all wallets)
    wallet_id = Column(
        UUID(as_uuid=True),
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=True,
        comment="Optional wallet scope; null means all wallets",
    )

    # Category this budget applies to
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Budget period (stored as first day of month)
    month = Column(
        Date,
        nullable=False,
        comment="First day of the budget month",
    )

    # Budget limit
    limit_amount = Column(
        Numeric(15, 2),
        nullable=False,
        comment="Budget limit for this category/month",
    )
    currency = Column(
        String(3),
        nullable=False,
        default="AED",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    wallet = relationship("Wallet")
    category = relationship("Category")

    __table_args__ = (
        UniqueConstraint(
            "wallet_id", "category_id", "month", name="uq_budget_wallet_category_month"
        ),
        Index("ix_budgets_wallet", "wallet_id"),
        Index("ix_budgets_category", "category_id"),
        Index("ix_budgets_month", "month"),
    )

    def __repr__(self) -> str:
        return f"<Budget(id={self.id}, category_id={self.category_id}, month={self.month}, limit={self.limit_amount})>"
