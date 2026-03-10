"""Wallet models for combined balance tracking."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
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


class Wallet(Base):
    """
    Combined wallet view.

    Groups one or more instruments (cards/accounts) for unified balance tracking.
    """

    __tablename__ = "wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)

    # Combined balance tracking
    combined_balance_last = Column(
        Numeric(15, 2),
        nullable=True,
        comment="Last known combined balance/limit",
    )
    currency = Column(
        String(3),
        nullable=False,
        default="AED",
        comment="ISO currency code",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    wallet_instruments = relationship(
        "WalletInstrument", back_populates="wallet", cascade="all, delete-orphan"
    )
    transaction_groups = relationship("TransactionGroup", back_populates="wallet")

    def __repr__(self) -> str:
        return f"<Wallet(id={self.id}, name={self.name}, balance={self.combined_balance_last})>"


class WalletInstrument(Base):
    """
    Junction table linking wallets to instruments.

    Allows a wallet to group multiple cards/accounts.
    """

    __tablename__ = "wallet_instruments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id = Column(
        UUID(as_uuid=True),
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False,
    )
    instrument_id = Column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    wallet = relationship("Wallet", back_populates="wallet_instruments")
    instrument = relationship("Instrument", back_populates="wallet_instruments")

    __table_args__ = (
        UniqueConstraint("wallet_id", "instrument_id", name="uq_wallet_instrument"),
        Index("ix_wallet_instruments_wallet", "wallet_id"),
        Index("ix_wallet_instruments_instrument", "instrument_id"),
    )

    def __repr__(self) -> str:
        return f"<WalletInstrument(wallet_id={self.wallet_id}, instrument_id={self.instrument_id})>"
