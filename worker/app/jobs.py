"""Background jobs for the worker."""

import structlog
import httpx
from uuid import UUID

from app.config import settings

logger = structlog.get_logger()


def trigger_parse_message(message_id: str) -> dict:
    """
    Trigger parsing for a message via the API.

    This job is queued by the IMAP ingester after storing new emails.
    It calls the backend API to parse the message.
    """
    # The API URL - when using network_mode: host, use localhost
    api_url = settings.api_url or "http://127.0.0.1:8003"

    try:
        # Call the internal parse endpoint
        # This endpoint should exist and not require auth for internal calls
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{api_url}/internal/parse-message",
                json={"message_id": message_id},
            )

            if response.status_code == 200:
                result = response.json()
                logger.info(
                    "parse_message_success",
                    message_id=message_id,
                    result=result,
                )
                return {"success": True, "result": result}
            else:
                logger.warning(
                    "parse_message_failed",
                    message_id=message_id,
                    status_code=response.status_code,
                    response=response.text,
                )
                return {"success": False, "error": response.text}

    except Exception as e:
        logger.exception("parse_message_error", message_id=message_id, error=str(e))
        return {"success": False, "error": str(e)}
