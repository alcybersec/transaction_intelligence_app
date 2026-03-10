"""Pydantic schemas for wallets, instruments, and institutions."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# ============== Institution Schemas ==============


class InstitutionResponse(BaseModel):
    """Response schema for an institution."""

    id: UUID
    name: str
    display_name: str
    parse_mode: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class InstitutionListResponse(BaseModel):
    """Response schema for institution list."""

    institutions: list[InstitutionResponse]
    total: int


# ============== Instrument Schemas ==============


class InstrumentCreateRequest(BaseModel):
    """Request to create a new instrument."""

    institution_id: UUID = Field(..., description="Institution this instrument belongs to")
    type: str = Field(..., description="Instrument type: 'card' or 'account'")
    display_name: str = Field(..., description="User-friendly name", min_length=1, max_length=255)
    last4: str | None = Field(None, description="Last 4 digits of card", min_length=4, max_length=4)
    account_tail: str | None = Field(
        None, description="Account number tail", min_length=1, max_length=20
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "institution_id": "123e4567-e89b-12d3-a456-426614174000",
                "type": "card",
                "display_name": "Mashreq Credit Card",
                "last4": "1234",
            }
        }
    }


class InstrumentUpdateRequest(BaseModel):
    """Request to update an instrument."""

    display_name: str | None = Field(None, min_length=1, max_length=255)
    last4: str | None = Field(None, min_length=4, max_length=4)
    account_tail: str | None = Field(None, min_length=1, max_length=20)
    is_active: bool | None = None


class InstrumentResponse(BaseModel):
    """Response schema for an instrument."""

    id: UUID
    institution_id: UUID
    institution_name: str | None = Field(None, description="Institution display name")
    type: str
    display_name: str
    last4: str | None
    account_tail: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    wallet_ids: list[UUID] = Field(
        default_factory=list, description="Wallets this instrument belongs to"
    )

    model_config = {"from_attributes": True}


class InstrumentListResponse(BaseModel):
    """Response schema for instrument list."""

    instruments: list[InstrumentResponse]
    total: int


# ============== Wallet Schemas ==============


class WalletCreateRequest(BaseModel):
    """Request to create a new wallet."""

    name: str = Field(..., description="Wallet name", min_length=1, max_length=255)
    currency: str = Field(
        default="AED", description="ISO currency code", min_length=3, max_length=3
    )
    instrument_ids: list[UUID] = Field(
        default_factory=list, description="Instruments to attach to this wallet"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Mashreq Combined",
                "currency": "AED",
                "instrument_ids": [
                    "123e4567-e89b-12d3-a456-426614174000",
                    "123e4567-e89b-12d3-a456-426614174001",
                ],
            }
        }
    }


class WalletUpdateRequest(BaseModel):
    """Request to update a wallet."""

    name: str | None = Field(None, min_length=1, max_length=255)
    currency: str | None = Field(None, min_length=3, max_length=3)


class WalletInstrumentAttachRequest(BaseModel):
    """Request to attach instruments to a wallet."""

    instrument_ids: list[UUID] = Field(..., description="Instruments to attach", min_length=1)


class WalletInstrumentDetachRequest(BaseModel):
    """Request to detach instruments from a wallet."""

    instrument_ids: list[UUID] = Field(..., description="Instruments to detach", min_length=1)


class WalletInstrumentResponse(BaseModel):
    """Response for instrument attached to a wallet."""

    id: UUID
    type: str
    display_name: str
    last4: str | None
    account_tail: str | None
    institution_name: str | None

    model_config = {"from_attributes": True}


class WalletResponse(BaseModel):
    """Response schema for a wallet."""

    id: UUID
    name: str
    combined_balance_last: Decimal | None
    currency: str
    created_at: datetime
    updated_at: datetime
    instruments: list[WalletInstrumentResponse] = Field(
        default_factory=list, description="Instruments in this wallet"
    )
    transaction_count: int = Field(default=0, description="Number of transactions in this wallet")

    model_config = {"from_attributes": True}


class WalletListResponse(BaseModel):
    """Response schema for wallet list."""

    wallets: list[WalletResponse]
    total: int


class WalletBalanceUpdateResponse(BaseModel):
    """Response after balance update."""

    wallet_id: UUID
    previous_balance: Decimal | None
    new_balance: Decimal | None
    currency: str
    updated_at: datetime


# ============== Dashboard/Summary Schemas ==============


class WalletSummaryResponse(BaseModel):
    """Summary of wallet for dashboard."""

    id: UUID
    name: str
    combined_balance_last: Decimal | None
    currency: str
    instrument_count: int
    recent_transaction_count: int = Field(default=0, description="Transactions in the last 30 days")
    total_spent_this_month: Decimal = Field(
        default=Decimal("0"), description="Total debits this month"
    )
    total_income_this_month: Decimal = Field(
        default=Decimal("0"), description="Total credits this month"
    )

    model_config = {"from_attributes": True}


class DashboardSummaryResponse(BaseModel):
    """Dashboard summary across all wallets."""

    wallets: list[WalletSummaryResponse]
    total_balance: Decimal | None = Field(
        None, description="Sum of all wallet balances (if same currency)"
    )
    currency: str = Field(default="AED")
