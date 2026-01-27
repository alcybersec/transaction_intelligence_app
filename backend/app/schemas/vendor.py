"""Pydantic schemas for vendors."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class VendorAliasResponse(BaseModel):
    """Response schema for a vendor alias."""

    id: UUID
    alias_raw: str
    alias_normalized: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryRuleResponse(BaseModel):
    """Response schema for a vendor category rule."""

    id: UUID
    vendor_id: UUID
    category_id: UUID
    category_name: str
    priority: int
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorResponse(BaseModel):
    """Response schema for a vendor."""

    id: UUID
    canonical_name: str
    created_at: datetime
    updated_at: datetime
    # Optional expanded fields
    alias_count: int | None = None
    transaction_count: int | None = None
    total_spent: Decimal | None = None
    category_id: UUID | None = None
    category_name: str | None = None

    model_config = {"from_attributes": True}


class VendorDetailResponse(VendorResponse):
    """Detailed vendor response with aliases and rules."""

    aliases: list[VendorAliasResponse] = []
    category_rules: list[CategoryRuleResponse] = []


class VendorListResponse(BaseModel):
    """Response for vendor list."""

    vendors: list[VendorResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class VendorCreateRequest(BaseModel):
    """Request to create a vendor (manual creation)."""

    canonical_name: str = Field(..., min_length=1, max_length=255)


class VendorUpdateRequest(BaseModel):
    """Request to update a vendor."""

    canonical_name: str | None = Field(None, min_length=1, max_length=255)


class VendorCategoryRuleRequest(BaseModel):
    """Request to set a vendor's category rule."""

    category_id: UUID
    priority: int = Field(default=0)
    enabled: bool = Field(default=True)


class VendorMergeRequest(BaseModel):
    """Request to merge vendors."""

    source_vendor_ids: list[UUID] = Field(..., min_length=1)
    target_vendor_id: UUID


class VendorStatsResponse(BaseModel):
    """Statistics for a vendor."""

    vendor_id: UUID
    canonical_name: str
    transaction_count: int
    total_debit: Decimal
    total_credit: Decimal
    first_transaction: datetime | None
    last_transaction: datetime | None
