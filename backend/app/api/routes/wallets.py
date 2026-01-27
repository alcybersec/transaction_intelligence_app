"""Wallet and instrument API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.wallet import (
    DashboardSummaryResponse,
    InstitutionListResponse,
    InstitutionResponse,
    InstrumentCreateRequest,
    InstrumentListResponse,
    InstrumentResponse,
    InstrumentUpdateRequest,
    WalletBalanceUpdateResponse,
    WalletCreateRequest,
    WalletInstrumentAttachRequest,
    WalletInstrumentDetachRequest,
    WalletInstrumentResponse,
    WalletListResponse,
    WalletResponse,
    WalletSummaryResponse,
    WalletUpdateRequest,
)
from app.services.wallet import WalletService

router = APIRouter()


def _build_instrument_response(instrument, wallet_ids: list[UUID] | None = None) -> InstrumentResponse:
    """Build instrument response from model."""
    return InstrumentResponse(
        id=instrument.id,
        institution_id=instrument.institution_id,
        institution_name=instrument.institution.display_name if instrument.institution else None,
        type=instrument.type.value,
        display_name=instrument.display_name,
        last4=instrument.last4,
        account_tail=instrument.account_tail,
        is_active=instrument.is_active,
        created_at=instrument.created_at,
        updated_at=instrument.updated_at,
        wallet_ids=wallet_ids or [],
    )


def _build_wallet_response(wallet, transaction_count: int = 0) -> WalletResponse:
    """Build wallet response from model."""
    instruments = []
    for wi in wallet.wallet_instruments:
        inst = wi.instrument
        instruments.append(
            WalletInstrumentResponse(
                id=inst.id,
                type=inst.type.value,
                display_name=inst.display_name,
                last4=inst.last4,
                account_tail=inst.account_tail,
                institution_name=inst.institution.display_name if inst.institution else None,
            )
        )

    return WalletResponse(
        id=wallet.id,
        name=wallet.name,
        combined_balance_last=wallet.combined_balance_last,
        currency=wallet.currency,
        created_at=wallet.created_at,
        updated_at=wallet.updated_at,
        instruments=instruments,
        transaction_count=transaction_count,
    )


# ============== Institution Endpoints ==============


@router.get("/institutions", response_model=InstitutionListResponse)
async def list_institutions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True, description="Only return active institutions"),
) -> InstitutionListResponse:
    """List all available institutions (banks)."""
    service = WalletService(db)
    institutions = service.list_institutions(active_only=active_only)

    return InstitutionListResponse(
        institutions=[
            InstitutionResponse(
                id=inst.id,
                name=inst.name,
                display_name=inst.display_name,
                parse_mode=inst.parse_mode,
                is_active=inst.is_active,
                created_at=inst.created_at,
            )
            for inst in institutions
        ],
        total=len(institutions),
    )


# ============== Instrument Endpoints ==============


@router.get("/instruments", response_model=InstrumentListResponse)
async def list_instruments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    institution_id: UUID | None = Query(None, description="Filter by institution"),
    active_only: bool = Query(True, description="Only return active instruments"),
    unassigned_only: bool = Query(False, description="Only return instruments not in any wallet"),
) -> InstrumentListResponse:
    """
    List instruments (cards/accounts).

    Supports filtering by institution and assignment status.
    """
    service = WalletService(db)
    instruments = service.list_instruments(
        institution_id=institution_id,
        active_only=active_only,
        unassigned_only=unassigned_only,
    )

    instrument_responses = []
    for inst in instruments:
        wallet_ids = service.get_instrument_wallet_ids(inst.id)
        instrument_responses.append(_build_instrument_response(inst, wallet_ids))

    return InstrumentListResponse(
        instruments=instrument_responses,
        total=len(instruments),
    )


@router.post("/instruments", response_model=InstrumentResponse, status_code=201)
async def create_instrument(
    payload: InstrumentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstrumentResponse:
    """
    Create a new instrument (card or account).

    For cards, provide last4 (last 4 digits).
    For accounts, provide account_tail (account identifier).
    """
    service = WalletService(db)

    # Validate institution exists
    institution = service.get_institution(payload.institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Validate type
    if payload.type not in ("card", "account"):
        raise HTTPException(status_code=400, detail="Type must be 'card' or 'account'")

    # Validate identifier
    if payload.type == "card" and not payload.last4:
        raise HTTPException(status_code=400, detail="last4 is required for card instruments")
    if payload.type == "account" and not payload.account_tail:
        raise HTTPException(status_code=400, detail="account_tail is required for account instruments")

    instrument = service.create_instrument(
        institution_id=payload.institution_id,
        instrument_type=payload.type,
        display_name=payload.display_name,
        last4=payload.last4,
        account_tail=payload.account_tail,
    )

    return _build_instrument_response(instrument, [])


@router.get("/instruments/{instrument_id}", response_model=InstrumentResponse)
async def get_instrument(
    instrument_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstrumentResponse:
    """Get an instrument by ID."""
    service = WalletService(db)
    instrument = service.get_instrument(instrument_id)

    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    wallet_ids = service.get_instrument_wallet_ids(instrument_id)
    return _build_instrument_response(instrument, wallet_ids)


@router.patch("/instruments/{instrument_id}", response_model=InstrumentResponse)
async def update_instrument(
    instrument_id: UUID,
    payload: InstrumentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstrumentResponse:
    """Update an instrument."""
    service = WalletService(db)

    instrument = service.update_instrument(
        instrument_id=instrument_id,
        display_name=payload.display_name,
        last4=payload.last4,
        account_tail=payload.account_tail,
        is_active=payload.is_active,
    )

    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    wallet_ids = service.get_instrument_wallet_ids(instrument_id)
    return _build_instrument_response(instrument, wallet_ids)


@router.delete("/instruments/{instrument_id}", status_code=204)
async def delete_instrument(
    instrument_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete an instrument.

    Note: This will also remove the instrument from any wallets.
    """
    service = WalletService(db)

    if not service.delete_instrument(instrument_id):
        raise HTTPException(status_code=404, detail="Instrument not found")


# ============== Wallet Endpoints ==============


@router.get("", response_model=WalletListResponse)
async def list_wallets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletListResponse:
    """List all wallets with their instruments."""
    service = WalletService(db)
    wallets = service.list_wallets()

    wallet_responses = []
    for wallet in wallets:
        txn_count = service.get_wallet_transaction_count(wallet.id)
        wallet_responses.append(_build_wallet_response(wallet, txn_count))

    return WalletListResponse(
        wallets=wallet_responses,
        total=len(wallets),
    )


@router.post("", response_model=WalletResponse, status_code=201)
async def create_wallet(
    payload: WalletCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResponse:
    """
    Create a new wallet.

    Optionally attach instruments by providing their IDs.
    """
    service = WalletService(db)

    # Validate instruments exist
    if payload.instrument_ids:
        for inst_id in payload.instrument_ids:
            if not service.get_instrument(inst_id):
                raise HTTPException(status_code=404, detail=f"Instrument {inst_id} not found")

    wallet = service.create_wallet(
        name=payload.name,
        currency=payload.currency,
        instrument_ids=payload.instrument_ids,
    )

    # Reload with instruments
    wallet = service.get_wallet(wallet.id)
    txn_count = service.get_wallet_transaction_count(wallet.id)
    return _build_wallet_response(wallet, txn_count)


@router.get("/{wallet_id}", response_model=WalletResponse)
async def get_wallet(
    wallet_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResponse:
    """Get a wallet by ID including its instruments."""
    service = WalletService(db)
    wallet = service.get_wallet(wallet_id)

    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    txn_count = service.get_wallet_transaction_count(wallet_id)
    return _build_wallet_response(wallet, txn_count)


@router.patch("/{wallet_id}", response_model=WalletResponse)
async def update_wallet(
    wallet_id: UUID,
    payload: WalletUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResponse:
    """Update a wallet's name or currency."""
    service = WalletService(db)

    wallet = service.update_wallet(
        wallet_id=wallet_id,
        name=payload.name,
        currency=payload.currency,
    )

    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    wallet = service.get_wallet(wallet_id)
    txn_count = service.get_wallet_transaction_count(wallet_id)
    return _build_wallet_response(wallet, txn_count)


@router.delete("/{wallet_id}", status_code=204)
async def delete_wallet(
    wallet_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a wallet.

    Note: This does NOT delete the instruments, only the wallet and its links.
    """
    service = WalletService(db)

    if not service.delete_wallet(wallet_id):
        raise HTTPException(status_code=404, detail="Wallet not found")


# ============== Wallet-Instrument Link Endpoints ==============


@router.post("/{wallet_id}/instruments", response_model=WalletResponse)
async def attach_instruments(
    wallet_id: UUID,
    payload: WalletInstrumentAttachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResponse:
    """Attach instruments to a wallet."""
    service = WalletService(db)

    # Verify wallet exists
    wallet = service.get_wallet(wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    attached = service.attach_instruments(wallet_id, payload.instrument_ids)

    if not attached and payload.instrument_ids:
        raise HTTPException(
            status_code=400,
            detail="No instruments were attached. They may already be attached or not exist.",
        )

    wallet = service.get_wallet(wallet_id)
    txn_count = service.get_wallet_transaction_count(wallet_id)
    return _build_wallet_response(wallet, txn_count)


@router.delete("/{wallet_id}/instruments", response_model=WalletResponse)
async def detach_instruments(
    wallet_id: UUID,
    payload: WalletInstrumentDetachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResponse:
    """Detach instruments from a wallet."""
    service = WalletService(db)

    # Verify wallet exists
    wallet = service.get_wallet(wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    service.detach_instruments(wallet_id, payload.instrument_ids)

    wallet = service.get_wallet(wallet_id)
    txn_count = service.get_wallet_transaction_count(wallet_id)
    return _build_wallet_response(wallet, txn_count)


# ============== Balance Endpoints ==============


@router.post("/{wallet_id}/recalculate-balance", response_model=WalletBalanceUpdateResponse)
async def recalculate_wallet_balance(
    wallet_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletBalanceUpdateResponse:
    """
    Recalculate wallet balance from the most recent transaction.

    This is useful if balance tracking got out of sync.
    """
    service = WalletService(db)

    wallet = service.get_wallet(wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    previous_balance = wallet.combined_balance_last
    new_balance = service.recalculate_wallet_balance(wallet_id)

    wallet = service.get_wallet(wallet_id)
    return WalletBalanceUpdateResponse(
        wallet_id=wallet_id,
        previous_balance=previous_balance,
        new_balance=new_balance,
        currency=wallet.currency,
        updated_at=wallet.updated_at,
    )


# ============== Dashboard/Summary Endpoints ==============


@router.get("/{wallet_id}/summary", response_model=WalletSummaryResponse)
async def get_wallet_summary(
    wallet_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = Query(30, ge=1, le=365, description="Days for recent stats"),
) -> WalletSummaryResponse:
    """Get wallet summary for dashboard display."""
    service = WalletService(db)

    summary = service.get_wallet_summary(wallet_id, days=days)
    if not summary:
        raise HTTPException(status_code=404, detail="Wallet not found")

    return WalletSummaryResponse(**summary)


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """Get overall dashboard summary across all wallets."""
    service = WalletService(db)
    summary = service.get_dashboard_summary()

    return DashboardSummaryResponse(
        wallets=[WalletSummaryResponse(**w) for w in summary["wallets"]],
        total_balance=summary["total_balance"],
        currency=summary["currency"],
    )
