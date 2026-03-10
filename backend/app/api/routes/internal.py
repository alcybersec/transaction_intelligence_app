"""Internal API endpoints for worker communication."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.services.parsing import ParsingService

router = APIRouter()
logger = get_logger(__name__)


class ParseMessageRequest(BaseModel):
    message_id: str


class ParseMessageResponse(BaseModel):
    success: bool
    message_id: str
    parse_status: str | None = None
    error: str | None = None


@router.post("/parse-message", response_model=ParseMessageResponse)
async def parse_message(
    request: ParseMessageRequest,
    db: Session = Depends(get_db),
) -> ParseMessageResponse:
    """
    Parse a single message by ID.

    This is an internal endpoint called by the worker after storing emails.
    No authentication required as it should only be accessible internally.
    """
    try:
        message_id = UUID(request.message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID format") from None

    try:
        service = ParsingService(db)
        result = service.process_single_message(message_id)

        if result["success"]:
            logger.info(
                "internal_parse_success",
                message_id=request.message_id,
                reversal_linked=result.get("reversal_linked", False),
            )
            return ParseMessageResponse(
                success=True,
                message_id=request.message_id,
                parse_status="success",
            )
        else:
            logger.warning(
                "internal_parse_failed",
                message_id=request.message_id,
                error=result.get("error"),
            )
            return ParseMessageResponse(
                success=False,
                message_id=request.message_id,
                parse_status=result.get("status", "failed"),
                error=result.get("error"),
            )

    except Exception as e:
        logger.exception("internal_parse_error", message_id=request.message_id, error=str(e))
        return ParseMessageResponse(
            success=False,
            message_id=request.message_id,
            error=str(e),
        )
