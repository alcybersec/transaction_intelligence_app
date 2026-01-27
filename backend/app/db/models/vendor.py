"""Vendor and category models for transaction categorization."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Category(Base):
    """
    Transaction category.

    User-managed categories for organizing transactions.
    """

    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    icon = Column(String(50), nullable=True, comment="Icon identifier or emoji")
    color = Column(String(7), nullable=True, comment="Hex color code")
    sort_order = Column(Integer, nullable=False, default=0)
    is_system = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="System categories cannot be deleted",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    vendor_rules = relationship("VendorCategoryRule", back_populates="category")
    category_suggestions = relationship("CategorySuggestion", back_populates="suggested_category")

    __table_args__ = (Index("ix_categories_sort_order", "sort_order"),)

    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name={self.name})>"


class Vendor(Base):
    """
    Normalized vendor/merchant.

    Represents a canonical vendor name after normalization.
    """

    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_name = Column(String(255), nullable=False, unique=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    aliases = relationship("VendorAlias", back_populates="vendor", cascade="all, delete-orphan")
    category_rules = relationship(
        "VendorCategoryRule", back_populates="vendor", cascade="all, delete-orphan"
    )
    category_suggestions = relationship(
        "CategorySuggestion", back_populates="vendor", cascade="all, delete-orphan"
    )
    transaction_groups = relationship("TransactionGroup", back_populates="vendor")

    def __repr__(self) -> str:
        return f"<Vendor(id={self.id}, canonical_name={self.canonical_name})>"


class VendorAlias(Base):
    """
    Vendor alias mapping.

    Maps raw vendor strings to canonical vendors.
    """

    __tablename__ = "vendor_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )

    alias_raw = Column(
        String(255),
        nullable=False,
        comment="Original raw vendor string from message",
    )
    alias_normalized = Column(
        String(255),
        nullable=False,
        comment="Normalized form (uppercase, collapsed whitespace)",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    vendor = relationship("Vendor", back_populates="aliases")

    __table_args__ = (
        UniqueConstraint("alias_normalized", name="uq_vendor_alias_normalized"),
        Index("ix_vendor_aliases_vendor", "vendor_id"),
        Index("ix_vendor_aliases_normalized", "alias_normalized"),
    )

    def __repr__(self) -> str:
        return f"<VendorAlias(id={self.id}, alias_raw={self.alias_raw}, vendor_id={self.vendor_id})>"


class VendorCategoryRule(Base):
    """
    Manual vendor to category mapping rule.

    User-defined rules that override AI suggestions.
    """

    __tablename__ = "vendor_category_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
    )

    priority = Column(Integer, nullable=False, default=0)
    enabled = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    vendor = relationship("Vendor", back_populates="category_rules")
    category = relationship("Category", back_populates="vendor_rules")

    __table_args__ = (
        UniqueConstraint("vendor_id", "category_id", name="uq_vendor_category_rule"),
        Index("ix_vendor_category_rules_vendor", "vendor_id"),
        Index("ix_vendor_category_rules_category", "category_id"),
    )

    def __repr__(self) -> str:
        return f"<VendorCategoryRule(vendor_id={self.vendor_id}, category_id={self.category_id})>"


class CategorySuggestion(Base):
    """
    AI-generated category suggestion.

    Stores AI suggestions for vendor categorization.
    """

    __tablename__ = "category_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )
    suggested_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
    )

    model = Column(String(100), nullable=False, comment="AI model used")
    confidence = Column(Float, nullable=True, comment="Confidence score 0-1")
    rationale = Column(Text, nullable=True, comment="AI explanation")

    status = Column(
        String(20),
        nullable=False,
        default="pending",
        comment="pending, accepted, rejected",
    )

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    vendor = relationship("Vendor", back_populates="category_suggestions")
    suggested_category = relationship("Category", back_populates="category_suggestions")

    __table_args__ = (
        Index("ix_category_suggestions_vendor", "vendor_id"),
        Index("ix_category_suggestions_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<CategorySuggestion(vendor_id={self.vendor_id}, category_id={self.suggested_category_id})>"
