"""Institution and instrument models for bank/card/account tracking."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class InstrumentType(enum.StrEnum):
    """Type of financial instrument."""

    CARD = "card"
    ACCOUNT = "account"


class Institution(Base):
    """
    Financial institution (bank).

    Stores bank-specific configuration for parsing.
    """

    __tablename__ = "institutions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    display_name = Column(String(255), nullable=False)

    # Parsing configuration
    sms_sender_patterns = Column(
        Text,
        nullable=True,
        comment="JSON array of sender patterns to match (e.g., ['MASHREQ', 'MashreqBank'])",
    )
    email_sender_patterns = Column(
        Text,
        nullable=True,
        comment="JSON array of email sender patterns",
    )
    parse_mode = Column(
        String(50),
        nullable=False,
        default="regex",
        comment="Default parsing mode: regex, ollama, hybrid",
    )
    sms_parse_mode = Column(
        String(50),
        nullable=True,
        comment="Parse mode for SMS messages: regex, ollama, hybrid. Falls back to parse_mode if null.",
    )
    email_parse_mode = Column(
        String(50),
        nullable=True,
        comment="Parse mode for email messages: regex, ollama, hybrid. Falls back to parse_mode if null.",
    )
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    instruments = relationship("Instrument", back_populates="institution")

    def get_parse_mode(self, source: str = "sms") -> str:
        """
        Get the parse mode for a specific message source.

        Args:
            source: Message source - "sms" or "email"

        Returns:
            Parse mode string: "regex", "ollama", or "hybrid"
        """
        if source == "sms" and self.sms_parse_mode:
            return self.sms_parse_mode
        elif source == "email" and self.email_parse_mode:
            return self.email_parse_mode
        return self.parse_mode or "regex"

    def __repr__(self) -> str:
        return f"<Institution(id={self.id}, name={self.name})>"


class Instrument(Base):
    """
    Financial instrument (card or account).

    Represents a specific card or account belonging to an institution.
    """

    __tablename__ = "instruments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="CASCADE"),
        nullable=False,
    )

    type = Column(
        Enum(InstrumentType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    display_name = Column(String(255), nullable=False)

    # Identifier (last 4 digits of card or account tail)
    last4 = Column(
        String(4),
        nullable=True,
        comment="Last 4 digits of card number",
    )
    account_tail = Column(
        String(20),
        nullable=True,
        comment="Account number tail/identifier",
    )

    # Encrypted full identifier (if available)
    raw_identifier_encrypted = Column(
        LargeBinary,
        nullable=True,
        comment="Full card/account number encrypted",
    )

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    institution = relationship("Institution", back_populates="instruments")
    wallet_instruments = relationship("WalletInstrument", back_populates="instrument")

    __table_args__ = (
        Index("ix_instruments_institution", "institution_id"),
        Index("ix_instruments_last4", "last4"),
        Index("ix_instruments_account_tail", "account_tail"),
    )

    def __repr__(self) -> str:
        return f"<Instrument(id={self.id}, type={self.type}, display_name={self.display_name})>"
