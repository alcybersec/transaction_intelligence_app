"""Report model for monthly financial reports."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Column,
    Date,
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


class ReportGeneratedBy(str, enum.Enum):
    """How the report was generated."""

    MANUAL = "manual"
    SCHEDULED = "scheduled"


class Report(Base):
    """
    Generated financial report.

    Stores monthly summary reports in markdown and PDF formats.
    """

    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Optional wallet scope
    wallet_id = Column(
        UUID(as_uuid=True),
        ForeignKey("wallets.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional wallet scope; null means all wallets",
    )

    # Report period
    period_start = Column(
        Date,
        nullable=False,
        comment="Report period start date",
    )
    period_end = Column(
        Date,
        nullable=False,
        comment="Report period end date",
    )

    # Report content
    report_markdown = Column(
        Text,
        nullable=True,
        comment="Report content in markdown format",
    )
    report_pdf_blob = Column(
        LargeBinary,
        nullable=True,
        comment="Generated PDF binary",
    )

    # Generation info
    generated_by = Column(
        Enum(ReportGeneratedBy, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ReportGeneratedBy.MANUAL,
    )
    ai_model = Column(
        String(100),
        nullable=True,
        comment="AI model used if AI-generated",
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

    __table_args__ = (
        Index("ix_reports_wallet", "wallet_id"),
        Index("ix_reports_period", "period_start", "period_end"),
        Index("ix_reports_created", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Report(id={self.id}, period={self.period_start} to {self.period_end})>"
