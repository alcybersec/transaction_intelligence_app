"""Pydantic schemas for reports."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReportGenerateRequest(BaseModel):
    """Request to generate a new report."""

    wallet_id: UUID | None = Field(None, description="Wallet scope (null for all wallets)")
    period_start: date = Field(..., description="Report period start date")
    period_end: date = Field(..., description="Report period end date")

    model_config = {
        "json_schema_extra": {
            "example": {
                "period_start": "2024-01-01",
                "period_end": "2024-01-31",
            }
        }
    }


class ReportResponse(BaseModel):
    """Response schema for a report."""

    id: UUID
    wallet_id: UUID | None
    wallet_name: str | None = None
    period_start: date
    period_end: date
    has_markdown: bool = Field(default=False, description="Whether markdown content exists")
    has_pdf: bool = Field(default=False, description="Whether PDF exists")
    generated_by: str
    ai_model: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportDetailResponse(BaseModel):
    """Response schema for a report with content."""

    id: UUID
    wallet_id: UUID | None
    wallet_name: str | None = None
    period_start: date
    period_end: date
    report_markdown: str | None = None
    has_pdf: bool = Field(default=False)
    generated_by: str
    ai_model: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    """Response schema for report list."""

    reports: list[ReportResponse]
    total: int
