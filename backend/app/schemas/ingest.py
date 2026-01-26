"""Pydantic schemas for SMS and email ingestion."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SMSIngestRequest(BaseModel):
    """Request schema for single SMS ingestion."""

    device_id: str = Field(
        ...,
        description="Unique device identifier (static per phone)",
        min_length=1,
        max_length=255,
    )
    sms_uid: str | None = Field(
        None,
        description="SMS unique ID if accessible, or hash(body + observed_at + sender)",
        max_length=255,
    )
    observed_at: datetime = Field(
        ...,
        description="Timestamp when SMS was received on the phone",
    )
    sender: str = Field(
        ...,
        description="SMS sender (phone number or alphanumeric ID)",
        min_length=1,
        max_length=255,
    )
    body: str = Field(
        ...,
        description="Full SMS body text",
        min_length=1,
    )
    source: str = Field(
        default="sms",
        description="Source type (always 'sms' for this endpoint)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "device_id": "pixel7-alex",
                "sms_uid": "abc123",
                "observed_at": "2024-01-15T10:30:00+04:00",
                "sender": "MASHREQ",
                "body": "Your Mashreq Card ending 1234 was used for AED 50.00 at CARREFOUR on 15-Jan-2024. Avl Cr Limit: AED 10,000.00",
                "source": "sms",
            }
        }
    }


class SMSIngestBatchRequest(BaseModel):
    """Request schema for batch SMS ingestion (offline queue catchup)."""

    messages: list[SMSIngestRequest] = Field(
        ...,
        description="List of SMS messages to ingest",
        min_length=1,
        max_length=500,
    )


class MessageResponse(BaseModel):
    """Response schema for a stored message."""

    id: UUID
    source: str
    source_uid: str
    observed_at: datetime
    sender: str
    created_at: datetime
    parse_status: str
    is_duplicate: bool = False

    model_config = {"from_attributes": True}


class SMSIngestResponse(BaseModel):
    """Response schema for single SMS ingestion."""

    status: str = Field(
        default="accepted",
        description="Ingestion status",
    )
    message: MessageResponse | None = Field(
        None,
        description="Created message details (None if duplicate)",
    )
    is_duplicate: bool = Field(
        default=False,
        description="Whether this message was already ingested",
    )


class SMSIngestBatchResponse(BaseModel):
    """Response schema for batch SMS ingestion."""

    status: str = Field(
        default="accepted",
        description="Overall batch status",
    )
    total: int = Field(
        description="Total messages in request",
    )
    accepted: int = Field(
        description="Number of new messages accepted",
    )
    duplicates: int = Field(
        description="Number of duplicate messages skipped",
    )
    last_sync_cursor: datetime | None = Field(
        None,
        description="Timestamp of most recent message (for Tasker to store)",
    )
    messages: list[MessageResponse] = Field(
        default_factory=list,
        description="Details of accepted messages",
    )
