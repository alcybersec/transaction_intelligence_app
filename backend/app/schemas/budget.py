"""Pydantic schemas for budgets."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class BudgetCreateRequest(BaseModel):
    """Request to create a new budget."""

    wallet_id: UUID | None = Field(None, description="Wallet scope (null for all wallets)")
    category_id: UUID = Field(..., description="Category to budget")
    month: date = Field(..., description="Budget month (first day of month)")
    limit_amount: Decimal = Field(..., gt=0, description="Budget limit amount")
    currency: str = Field(default="AED", min_length=3, max_length=3)

    model_config = {
        "json_schema_extra": {
            "example": {
                "category_id": "123e4567-e89b-12d3-a456-426614174000",
                "month": "2024-01-01",
                "limit_amount": "5000.00",
                "currency": "AED",
            }
        }
    }


class BudgetUpdateRequest(BaseModel):
    """Request to update a budget."""

    limit_amount: Decimal | None = Field(None, gt=0)
    currency: str | None = Field(None, min_length=3, max_length=3)


class BudgetResponse(BaseModel):
    """Response schema for a budget."""

    id: UUID
    wallet_id: UUID | None
    wallet_name: str | None = None
    category_id: UUID
    category_name: str | None = None
    category_icon: str | None = None
    category_color: str | None = None
    month: date
    limit_amount: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetProgressResponse(BaseModel):
    """Budget with spending progress."""

    id: UUID
    wallet_id: UUID | None
    wallet_name: str | None = None
    category_id: UUID
    category_name: str
    category_icon: str | None = None
    category_color: str | None = None
    month: date
    limit_amount: Decimal
    spent_amount: Decimal = Field(default=Decimal("0"), description="Amount spent in this category this month")
    remaining_amount: Decimal = Field(default=Decimal("0"), description="Amount remaining in budget")
    percentage_used: float = Field(default=0.0, description="Percentage of budget used (0-100+)")
    is_over_budget: bool = Field(default=False, description="Whether spending exceeds budget")
    currency: str

    model_config = {"from_attributes": True}


class BudgetListResponse(BaseModel):
    """Response schema for budget list."""

    budgets: list[BudgetProgressResponse]
    total: int
    month: date


class BudgetSummaryResponse(BaseModel):
    """Summary of all budgets for a month."""

    month: date
    total_budgeted: Decimal
    total_spent: Decimal
    total_remaining: Decimal
    budgets_count: int
    over_budget_count: int
    currency: str
