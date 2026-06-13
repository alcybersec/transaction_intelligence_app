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

    # Category this budget applies to.
    # Null = "overall monthly budget" covering all spending in the month.
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=True,
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

    # Uniqueness is enforced at the DB layer via two partial indexes (see
    # alembic 014_budget_category_nullable):
    #   - uq_budget_wallet_category_month over (wallet_id, category_id, month)
    #     WHERE category_id IS NOT NULL
    #   - uq_budget_wallet_overall_month over (COALESCE(wallet_id), month)
    #     WHERE category_id IS NULL
    # SQLAlchemy can't model partial-unique-indexes portably, so we omit them
    # here. Tests use Base.metadata.create_all which means duplicate overall
    # budgets are rejected at the service level (ValueError -> 409).
    __table_args__ = (
        Index("ix_budgets_wallet", "wallet_id"),
        Index("ix_budgets_category", "category_id"),
        Index("ix_budgets_month", "month"),
    )

    def __repr__(self) -> str:
        return f"<Budget(id={self.id}, category_id={self.category_id}, month={self.month}, limit={self.limit_amount})>"
