"""Pydantic schemas for authentication."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Login request payload."""

    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Token response after successful login."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str


class RefreshResponse(BaseModel):
    """Token refresh response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User information response."""

    id: UUID
    username: str
    display_name: str | None
    is_admin: bool
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    """Request to create a new user (admin only)."""

    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)
    display_name: str | None = Field(None, max_length=255)
    is_admin: bool = False


class ChangePasswordRequest(BaseModel):
    """Request to change password."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


# Update forward reference
TokenResponse.model_rebuild()
