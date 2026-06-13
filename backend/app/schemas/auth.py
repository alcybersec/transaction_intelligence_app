"""Pydantic schemas for authentication."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


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
    email: str | None = None
    display_name: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    is_admin: bool
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class UserMeUpdate(BaseModel):
    """Profile update payload for PATCH /auth/me."""

    email: EmailStr | None = None
    display_name: str | None = Field(None, max_length=120)
    preferences: dict[str, Any] | None = None

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: EmailStr | None) -> str | None:
        if v is None:
            return None
        return str(v).strip().lower()


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


class TwoFactorEnableResponse(BaseModel):
    """Response when enabling 2FA: contains the new TOTP secret + otpauth URL."""

    secret: str
    otpauth_url: str


class TwoFactorVerifyRequest(BaseModel):
    """Request to verify a TOTP code."""

    code: str = Field(..., min_length=1, max_length=12)


class TwoFactorVerifyResponse(BaseModel):
    """Result of a TOTP verification."""

    verified: bool


class SessionResponse(BaseModel):
    """One persisted user session row."""

    id: str
    user_agent: str | None
    ip_address: str | None
    created_at: str
    last_seen_at: str


# Update forward reference
TokenResponse.model_rebuild()
