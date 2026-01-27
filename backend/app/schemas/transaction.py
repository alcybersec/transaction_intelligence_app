"""Pydantic schemas for transactions and parsing."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ParsedTransaction(BaseModel):
    """
    Contract for parsed transaction data.

    This schema is used by both regex and AI parsers to ensure consistent output.
    """

    # Required fields
    amount: Decimal = Field(..., description="Transaction amount")
    currency: str = Field(default="AED", description="ISO currency code")
    direction: str = Field(..., description="debit or credit")

    # Timestamps
    occurred_at: datetime | None = Field(
        None, description="Transaction time from message (if extractable)"
    )

    # Vendor
    vendor_raw: str | None = Field(None, description="Raw vendor/merchant string from message")

    # Instrument identification
    card_last4: str | None = Field(None, description="Last 4 digits of card")
    account_tail: str | None = Field(None, description="Account number tail")

    # Balance
    available_balance: Decimal | None = Field(
        None, description="Available balance/limit after transaction"
    )

    # Reference
    reference_id: str | None = Field(None, description="Transaction reference/approval code")

    # Parsing metadata
    institution_name: str | None = Field(None, description="Detected institution name")
    parse_confidence: float | None = Field(
        None, description="Confidence score 0-1 (for AI parsing)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "amount": "150.00",
                "currency": "AED",
                "direction": "debit",
                "occurred_at": "2024-01-15T14:30:00+04:00",
                "vendor_raw": "CARREFOUR CITY CENTRE",
                "card_last4": "1234",
                "available_balance": "9850.00",
                "reference_id": "AUTH123456",
                "institution_name": "mashreq",
            }
        }
    }


class TransactionGroupResponse(BaseModel):
    """Response schema for a transaction group."""

    id: UUID
    wallet_id: UUID | None
    instrument_id: UUID | None
    direction: str
    amount: Decimal
    currency: str
    occurred_at: datetime
    observed_at_min: datetime
    observed_at_max: datetime
    vendor_id: UUID | None
    vendor_raw: str | None
    vendor_name: str | None = Field(None, description="Canonical vendor name")
    category_id: UUID | None
    category_name: str | None = Field(None, description="Category name")
    reference_id: str | None
    combined_balance_after: Decimal | None
    status: str
    notes: str | None
    evidence_count: int = Field(default=1, description="Number of linked evidence messages")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionGroupListResponse(BaseModel):
    """Response schema for transaction list."""

    transactions: list[TransactionGroupResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class TransactionEvidenceResponse(BaseModel):
    """Response schema for transaction evidence."""

    id: UUID
    message_id: UUID
    role: str
    source: str
    sender: str
    observed_at: datetime
    raw_body: str | None = Field(None, description="Decrypted body if requested")

    model_config = {"from_attributes": True}


class TransactionDetailResponse(TransactionGroupResponse):
    """Detailed transaction response including evidence."""

    evidence: list[TransactionEvidenceResponse] = []


class TransactionFilterRequest(BaseModel):
    """Filter parameters for transaction listing."""

    wallet_id: UUID | None = None
    vendor_id: UUID | None = None
    category_id: UUID | None = None
    direction: str | None = None
    status: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    amount_min: Decimal | None = None
    amount_max: Decimal | None = None
    search: str | None = Field(None, description="Search in vendor name or notes")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class TransactionNotesUpdate(BaseModel):
    """Request to update transaction notes."""

    notes: str | None = Field(None, max_length=1000)


class ReviewQueueItem(BaseModel):
    """Item in the review queue (parse failures or ambiguous merges)."""

    message_id: UUID
    source: str
    sender: str
    observed_at: datetime
    parse_status: str
    parse_error: str | None
    raw_body_preview: str = Field(description="First 200 chars of decrypted body")
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewQueueResponse(BaseModel):
    """Response for review queue listing."""

    items: list[ReviewQueueItem]
    total: int
    page: int
    page_size: int


class ManualParseRequest(BaseModel):
    """Request to manually parse/re-parse a message."""

    message_id: UUID
    parse_mode: str = Field(default="regex", description="regex, ollama, or hybrid")


class ManualParseResponse(BaseModel):
    """Response from manual parse request."""

    success: bool
    message_id: UUID
    parse_status: str
    parse_error: str | None = None
    transaction_group_id: UUID | None = None
    parsed_data: ParsedTransaction | None = None
