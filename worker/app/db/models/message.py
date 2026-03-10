"""Message model - mirrors backend/app/db/models/message.py."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Index,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


class MessageSource(enum.StrEnum):
    """Source type for messages."""

    SMS = "sms"
    EMAIL = "email"


class ParseStatus(enum.StrEnum):
    """Parsing status for messages."""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"


class ParseMode(enum.StrEnum):
    """Parsing mode used for extraction."""

    REGEX = "regex"
    OLLAMA = "ollama"
    HYBRID = "hybrid"


class Message(Base):
    """
    Immutable message evidence table.

    Stores raw SMS and email bodies encrypted, with metadata for deduplication
    and tracking parse status.
    """

    __tablename__ = "messages"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source identification
    source = Column(
        Enum(MessageSource, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    source_uid = Column(
        String(255),
        nullable=False,
        comment="SMS UID hash or IMAP UID+MessageID",
    )

    # Timestamps
    observed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When message was received on phone/email (IMAP INTERNALDATE)",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )

    # Message content
    sender = Column(String(255), nullable=False, index=True)
    raw_body_encrypted = Column(
        LargeBinary,
        nullable=False,
        comment="Fernet-encrypted raw message body",
    )
    raw_body_hash = Column(
        String(64),
        nullable=False,
        index=True,
        comment="SHA-256 hash for deduplication",
    )

    # Device tracking (for SMS)
    device_id = Column(
        String(255),
        nullable=True,
        index=True,
        comment="Device identifier for SMS sources",
    )

    # Parsing state
    parse_status = Column(
        Enum(ParseStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ParseStatus.PENDING,
        index=True,
    )
    parse_mode = Column(
        Enum(ParseMode, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
        comment="Which parsing method was used",
    )
    parse_error = Column(
        Text,
        nullable=True,
        comment="Error message if parsing failed",
    )

    # Constraints for idempotency
    __table_args__ = (
        UniqueConstraint("source", "source_uid", name="uq_messages_source_uid"),
        Index("ix_messages_hash_observed", "raw_body_hash", "observed_at"),
        Index("ix_messages_source_observed", "source", "observed_at"),
    )

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, source={self.source}, sender={self.sender})>"
