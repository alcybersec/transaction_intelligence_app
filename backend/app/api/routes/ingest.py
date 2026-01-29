"""SMS ingestion endpoints."""

import hashlib
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.routes.health import increment_metric
from app.core.encryption import encrypt_body, hash_body
from app.core.logging import get_logger
from app.core.security import HMACVerificationError, verify_hmac_signature
from app.core.metrics import messages_ingested_total
from app.db.models.message import Message, MessageSource, ParseStatus
from app.db.session import get_db, SessionLocal
from app.schemas.ingest import (
    MessageResponse,
    SMSIngestBatchRequest,
    SMSIngestBatchResponse,
    SMSIngestRequest,
    SMSIngestResponse,
)

router = APIRouter()
logger = get_logger(__name__)


def _trigger_parsing_background(message_id: UUID) -> None:
    """
    Background task to parse a single message after ingest.

    Creates its own database session since background tasks run
    outside the request context.
    """
    from app.services.parsing import ParsingService

    db = SessionLocal()
    try:
        service = ParsingService(db)
        result = service.process_single_message(message_id)
        if result["success"]:
            logger.info(
                "auto_parse_success",
                message_id=str(message_id),
                reversal_linked=result.get("reversal_linked", False),
            )
        else:
            logger.warning(
                "auto_parse_failed",
                message_id=str(message_id),
                error=result.get("error"),
            )
    except Exception as e:
        logger.exception("auto_parse_error", message_id=str(message_id), error=str(e))
    finally:
        db.close()


def _generate_source_uid(request: SMSIngestRequest) -> str:
    """Generate source_uid from request data if not provided."""
    if request.sms_uid:
        return request.sms_uid

    # Generate hash from body + observed_at + sender
    data = f"{request.body}|{request.observed_at.isoformat()}|{request.sender}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


def _check_duplicate(db: Session, source: MessageSource, source_uid: str) -> Message | None:
    """Check if a message with this source_uid already exists."""
    return (
        db.query(Message).filter(Message.source == source, Message.source_uid == source_uid).first()
    )


def _create_message(db: Session, request: SMSIngestRequest) -> tuple[Message, bool]:
    """
    Create a message from ingestion request.

    Returns:
        Tuple of (Message, is_duplicate)
    """
    source_uid = _generate_source_uid(request)

    # Check for duplicate
    existing = _check_duplicate(db, MessageSource.SMS, source_uid)
    if existing:
        increment_metric("messages_deduped")
        messages_ingested_total.labels(source="sms", status="duplicate").inc()
        return existing, True

    # Create new message
    message = Message(
        source=MessageSource.SMS,
        source_uid=source_uid,
        observed_at=request.observed_at,
        sender=request.sender,
        raw_body_encrypted=encrypt_body(request.body),
        raw_body_hash=hash_body(request.body),
        device_id=request.device_id,
        parse_status=ParseStatus.PENDING,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    increment_metric("messages_ingested")
    messages_ingested_total.labels(source="sms", status="accepted").inc()
    return message, False


async def _verify_request_hmac(
    request: Request,
    x_device_id: str = Header(...),
    x_timestamp: str = Header(...),
    x_signature: str = Header(...),
) -> None:
    """Verify HMAC signature for ingestion requests."""
    body = await request.body()

    try:
        verify_hmac_signature(x_device_id, x_timestamp, x_signature, body)
    except HMACVerificationError as e:
        raise HTTPException(status_code=401, detail=str(e)) from None


@router.post("/sms", response_model=SMSIngestResponse)
async def ingest_sms(
    request: Request,
    payload: SMSIngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_device_id: str = Header(..., description="Device identifier"),
    x_timestamp: str = Header(..., description="Request timestamp (Unix or ISO)"),
    x_signature: str = Header(..., description="HMAC-SHA256 signature"),
) -> SMSIngestResponse:
    """
    Ingest a single SMS message.

    This endpoint receives SMS messages from Tasker and stores them
    with encryption. Implements idempotency via source_uid deduplication.
    New messages are automatically queued for parsing in the background.

    Headers required:
    - X-Device-Id: Unique device identifier
    - X-Timestamp: Request timestamp for replay protection
    - X-Signature: HMAC-SHA256(secret, device_id + timestamp + body)
    """
    # Verify HMAC
    body = await request.body()
    try:
        verify_hmac_signature(x_device_id, x_timestamp, x_signature, body)
    except HMACVerificationError as e:
        raise HTTPException(status_code=401, detail=str(e)) from None

    # Verify device_id matches
    if payload.device_id != x_device_id:
        raise HTTPException(
            status_code=400,
            detail="Device ID in payload does not match header",
        )

    message, is_duplicate = _create_message(db, payload)

    # Trigger background parsing for new messages
    if not is_duplicate:
        background_tasks.add_task(_trigger_parsing_background, message.id)

    return SMSIngestResponse(
        status="accepted" if not is_duplicate else "duplicate",
        message=MessageResponse(
            id=message.id,
            source=message.source.value,
            source_uid=message.source_uid,
            observed_at=message.observed_at,
            sender=message.sender,
            created_at=message.created_at,
            parse_status=message.parse_status.value,
            is_duplicate=is_duplicate,
        ),
        is_duplicate=is_duplicate,
    )


@router.post("/sms/batch", response_model=SMSIngestBatchResponse)
async def ingest_sms_batch(
    request: Request,
    payload: SMSIngestBatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_device_id: str = Header(..., description="Device identifier"),
    x_timestamp: str = Header(..., description="Request timestamp (Unix or ISO)"),
    x_signature: str = Header(..., description="HMAC-SHA256 signature"),
) -> SMSIngestBatchResponse:
    """
    Ingest a batch of SMS messages (offline queue catch-up).

    This endpoint receives queued SMS messages that accumulated while
    offline. Implements idempotency for each message.
    New messages are automatically queued for parsing in the background.

    Headers required:
    - X-Device-Id: Unique device identifier
    - X-Timestamp: Request timestamp for replay protection
    - X-Signature: HMAC-SHA256(secret, device_id + timestamp + body)
    """
    # Verify HMAC
    body = await request.body()
    try:
        verify_hmac_signature(x_device_id, x_timestamp, x_signature, body)
    except HMACVerificationError as e:
        raise HTTPException(status_code=401, detail=str(e)) from None

    accepted_messages = []
    duplicates = 0
    last_observed: datetime | None = None
    new_message_ids: list[UUID] = []

    for sms in payload.messages:
        # Verify device_id matches
        if sms.device_id != x_device_id:
            continue  # Skip messages from other devices

        message, is_duplicate = _create_message(db, sms)

        if is_duplicate:
            duplicates += 1
        else:
            accepted_messages.append(
                MessageResponse(
                    id=message.id,
                    source=message.source.value,
                    source_uid=message.source_uid,
                    observed_at=message.observed_at,
                    sender=message.sender,
                    created_at=message.created_at,
                    parse_status=message.parse_status.value,
                    is_duplicate=False,
                )
            )
            new_message_ids.append(message.id)

        # Track most recent message for sync cursor
        if last_observed is None or message.observed_at > last_observed:
            last_observed = message.observed_at

    # Trigger background parsing for all new messages
    for message_id in new_message_ids:
        background_tasks.add_task(_trigger_parsing_background, message_id)

    return SMSIngestBatchResponse(
        status="accepted",
        total=len(payload.messages),
        accepted=len(accepted_messages),
        duplicates=duplicates,
        last_sync_cursor=last_observed,
        messages=accepted_messages,
    )
