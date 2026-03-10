"""Transaction API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.encryption import decrypt_body
from app.db.models import (
    Message,
    ParseMode,
    ParseStatus,
    TransactionDirection,
    TransactionEvidence,
    TransactionGroup,
    TransactionStatus,
    User,
    Vendor,
)
from app.db.session import get_db
from app.schemas.transaction import (
    ManualParseRequest,
    ManualParseResponse,
    ReviewQueueItem,
    ReviewQueueResponse,
    TransactionDetailResponse,
    TransactionEvidenceResponse,
    TransactionGroupListResponse,
    TransactionGroupResponse,
    TransactionNotesUpdate,
)
from app.services.merge import MergeEngine
from app.services.parsing import ParsingService
from app.services.vendor import VendorService

router = APIRouter()


def _build_transaction_response(
    txn: TransactionGroup, evidence_count: int | None = None
) -> TransactionGroupResponse:
    """Build a transaction response from a model."""
    return TransactionGroupResponse(
        id=txn.id,
        wallet_id=txn.wallet_id,
        instrument_id=txn.instrument_id,
        direction=txn.direction.value,
        amount=txn.amount,
        currency=txn.currency,
        occurred_at=txn.occurred_at,
        observed_at_min=txn.observed_at_min,
        observed_at_max=txn.observed_at_max,
        vendor_id=txn.vendor_id,
        vendor_raw=txn.vendor_raw,
        vendor_name=txn.vendor.canonical_name if txn.vendor else None,
        category_id=txn.category_id,
        category_name=txn.category.name if txn.category else None,
        reference_id=txn.reference_id,
        combined_balance_after=txn.combined_balance_after,
        status=txn.status.value,
        notes=txn.notes,
        evidence_count=evidence_count or len(txn.evidence),
        created_at=txn.created_at,
        updated_at=txn.updated_at,
    )


@router.get("", response_model=TransactionGroupListResponse)
async def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    wallet_id: UUID | None = Query(None),
    vendor_id: UUID | None = Query(None),
    category_id: UUID | None = Query(None),
    direction: str | None = Query(None),
    status: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    amount_min: float | None = Query(None),
    amount_max: float | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> TransactionGroupListResponse:
    """
    List transactions with optional filters.

    Supports filtering by:
    - wallet_id: Filter by wallet
    - vendor_id: Filter by vendor
    - category_id: Filter by category
    - direction: "debit" or "credit"
    - status: "posted", "reversed", "refunded", "unknown"
    - date_from/date_to: Date range (occurred_at)
    - amount_min/amount_max: Amount range
    - search: Search in vendor name or notes
    """
    query = db.query(TransactionGroup).options(
        joinedload(TransactionGroup.vendor), joinedload(TransactionGroup.category)
    )

    # Apply filters
    if wallet_id:
        query = query.filter(TransactionGroup.wallet_id == wallet_id)

    if vendor_id:
        query = query.filter(TransactionGroup.vendor_id == vendor_id)

    if category_id:
        query = query.filter(TransactionGroup.category_id == category_id)

    if direction:
        try:
            dir_enum = TransactionDirection(direction)
            query = query.filter(TransactionGroup.direction == dir_enum)
        except ValueError:
            pass

    if status:
        try:
            status_enum = TransactionStatus(status)
            query = query.filter(TransactionGroup.status == status_enum)
        except ValueError:
            pass

    if date_from:
        query = query.filter(TransactionGroup.occurred_at >= date_from)

    if date_to:
        query = query.filter(TransactionGroup.occurred_at <= date_to)

    if amount_min is not None:
        query = query.filter(TransactionGroup.amount >= amount_min)

    if amount_max is not None:
        query = query.filter(TransactionGroup.amount <= amount_max)

    if search:
        search_filter = f"%{search}%"
        query = query.outerjoin(Vendor).filter(
            or_(
                TransactionGroup.notes.ilike(search_filter),
                TransactionGroup.vendor_raw.ilike(search_filter),
                Vendor.canonical_name.ilike(search_filter),
            )
        )

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    offset = (page - 1) * page_size
    transactions = (
        query.order_by(TransactionGroup.occurred_at.desc()).offset(offset).limit(page_size).all()
    )

    # Build response
    return TransactionGroupListResponse(
        transactions=[_build_transaction_response(txn) for txn in transactions],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(transactions)) < total,
    )


@router.get("/{transaction_id}", response_model=TransactionDetailResponse)
async def get_transaction(
    transaction_id: UUID,
    include_body: bool = Query(False, description="Include decrypted message bodies"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionDetailResponse:
    """
    Get transaction details including evidence.

    The evidence includes linked SMS/email messages. Set include_body=true
    to include decrypted message bodies (read-only evidence).
    """
    txn = (
        db.query(TransactionGroup)
        .options(
            joinedload(TransactionGroup.vendor),
            joinedload(TransactionGroup.category),
            joinedload(TransactionGroup.evidence).joinedload(TransactionEvidence.message),
        )
        .filter(TransactionGroup.id == transaction_id)
        .first()
    )

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Build evidence responses
    evidence_responses = []
    for ev in txn.evidence:
        msg = ev.message
        raw_body = None
        if include_body and msg.raw_body_encrypted:
            try:
                raw_body = decrypt_body(msg.raw_body_encrypted)
            except Exception:
                raw_body = "[Decryption failed]"

        evidence_responses.append(
            TransactionEvidenceResponse(
                id=ev.id,
                message_id=ev.message_id,
                role=ev.role.value,
                source=msg.source.value,
                sender=msg.sender,
                observed_at=msg.observed_at,
                raw_body=raw_body,
            )
        )

    return TransactionDetailResponse(
        id=txn.id,
        wallet_id=txn.wallet_id,
        instrument_id=txn.instrument_id,
        direction=txn.direction.value,
        amount=txn.amount,
        currency=txn.currency,
        occurred_at=txn.occurred_at,
        observed_at_min=txn.observed_at_min,
        observed_at_max=txn.observed_at_max,
        vendor_id=txn.vendor_id,
        vendor_raw=txn.vendor_raw,
        vendor_name=txn.vendor.canonical_name if txn.vendor else None,
        category_id=txn.category_id,
        category_name=txn.category.name if txn.category else None,
        reference_id=txn.reference_id,
        combined_balance_after=txn.combined_balance_after,
        status=txn.status.value,
        notes=txn.notes,
        evidence_count=len(txn.evidence),
        created_at=txn.created_at,
        updated_at=txn.updated_at,
        evidence=evidence_responses,
    )


@router.patch("/{transaction_id}/notes", response_model=TransactionGroupResponse)
async def update_transaction_notes(
    transaction_id: UUID,
    payload: TransactionNotesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionGroupResponse:
    """
    Update transaction notes.

    Notes are user-editable and do not affect the raw evidence.
    """
    txn = (
        db.query(TransactionGroup)
        .options(joinedload(TransactionGroup.vendor), joinedload(TransactionGroup.category))
        .filter(TransactionGroup.id == transaction_id)
        .first()
    )

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn.notes = payload.notes
    txn.updated_at = datetime.utcnow()
    db.commit()

    return _build_transaction_response(txn)


@router.get("/review/queue", response_model=ReviewQueueResponse)
async def get_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: str | None = Query(None, description="Filter by parse_status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> ReviewQueueResponse:
    """
    Get messages that need review.

    Returns messages with parse_status of FAILED or NEEDS_REVIEW.
    """
    query = db.query(Message).filter(
        Message.parse_status.in_([ParseStatus.FAILED, ParseStatus.NEEDS_REVIEW])
    )

    if status:
        try:
            status_enum = ParseStatus(status)
            query = query.filter(Message.parse_status == status_enum)
        except ValueError:
            pass

    total = query.count()

    offset = (page - 1) * page_size
    messages = query.order_by(Message.observed_at.desc()).offset(offset).limit(page_size).all()

    items = []
    for msg in messages:
        # Get preview of body
        preview = ""
        try:
            body = decrypt_body(msg.raw_body_encrypted)
            preview = body[:200] + "..." if len(body) > 200 else body
        except Exception:
            preview = "[Decryption failed]"

        items.append(
            ReviewQueueItem(
                message_id=msg.id,
                source=msg.source.value,
                sender=msg.sender,
                observed_at=msg.observed_at,
                parse_status=msg.parse_status.value,
                parse_error=msg.parse_error,
                raw_body_preview=preview,
                created_at=msg.created_at,
            )
        )

    return ReviewQueueResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/review/{message_id}/parse", response_model=ManualParseResponse)
async def manual_parse_message(
    message_id: UUID,
    payload: ManualParseRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ManualParseResponse:
    """
    Manually trigger parsing for a message.

    Can be used to re-parse failed messages with a different mode.
    """
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Determine parse mode
    mode = ParseMode.REGEX
    if payload and payload.parse_mode:
        try:
            mode = ParseMode(payload.parse_mode)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"Invalid parse mode: {payload.parse_mode}"
            ) from None

    # Decrypt body
    try:
        body = decrypt_body(message.raw_body_encrypted)
    except Exception as e:
        return ManualParseResponse(
            success=False,
            message_id=message_id,
            parse_status=message.parse_status.value,
            parse_error=f"Decryption failed: {str(e)}",
        )

    # Parse message
    vendor_service = VendorService(db)
    parsing_service = ParsingService(db)
    merge_engine = MergeEngine(db, vendor_service)

    parsed, error = parsing_service.parse_message(message, body, mode)

    if not parsed:
        message.parse_status = ParseStatus.FAILED
        message.parse_mode = mode
        message.parse_error = error
        db.commit()

        return ManualParseResponse(
            success=False,
            message_id=message_id,
            parse_status=message.parse_status.value,
            parse_error=error,
        )

    # Try to merge
    try:
        txn_group = merge_engine.process_parsed_transaction(message, parsed)
        message.parse_status = ParseStatus.SUCCESS
        message.parse_mode = mode
        message.parse_error = None
        db.commit()

        return ManualParseResponse(
            success=True,
            message_id=message_id,
            parse_status=message.parse_status.value,
            transaction_group_id=txn_group.id,
            parsed_data=parsed,
        )

    except ValueError as e:
        message.parse_status = ParseStatus.NEEDS_REVIEW
        message.parse_mode = mode
        message.parse_error = str(e)
        db.commit()

        return ManualParseResponse(
            success=False,
            message_id=message_id,
            parse_status=message.parse_status.value,
            parse_error=str(e),
            parsed_data=parsed,
        )


@router.post("/process-pending")
async def process_pending_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000),
) -> dict:
    """
    Process pending messages in batch.

    This endpoint triggers parsing for all messages with parse_status=PENDING.
    Returns statistics about processing results.
    """
    parsing_service = ParsingService(db)
    stats = parsing_service.process_pending_messages(limit=limit)

    return {
        "status": "completed",
        "stats": stats,
    }
