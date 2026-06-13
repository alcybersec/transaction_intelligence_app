"""Savings goal Pydantic schemas."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer, field_validator


class SavingsGoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target_amount: Decimal = Field(..., gt=0)
    target_date: date
    color: str | None = Field(None, max_length=20)

    @field_validator("target_date")
    @classmethod
    def _must_be_future(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("target_date must be in the future")
        return v


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    target_amount: Decimal | None = Field(None, gt=0)
    target_date: date | None = None
    color: str | None = Field(None, max_length=20)


class SavingsGoalContribute(BaseModel):
    amount: Decimal = Field(..., gt=0)


class SavingsGoalResponse(BaseModel):
    id: UUID
    name: str
    target_amount: Decimal
    saved_amount: Decimal
    target_date: date
    color: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("target_amount", "saved_amount")
    def _ser_money(self, v: Decimal) -> str:
        return f"{v:.2f}"
