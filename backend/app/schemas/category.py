"""Pydantic schemas for categories."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryResponse(BaseModel):
    """Response schema for a category."""

    id: UUID
    name: str
    icon: str | None
    color: str | None
    sort_order: int
    is_system: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryListResponse(BaseModel):
    """Response for category list."""

    categories: list[CategoryResponse]
    total: int


class CategoryCreateRequest(BaseModel):
    """Request to create a category."""

    name: str = Field(..., min_length=1, max_length=100)
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: int = Field(default=0)


class CategoryUpdateRequest(BaseModel):
    """Request to update a category."""

    name: str | None = Field(None, min_length=1, max_length=100)
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: int | None = None
