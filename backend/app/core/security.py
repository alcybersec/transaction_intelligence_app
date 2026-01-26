"""Security utilities for ingestion endpoint protection."""

import hashlib
import hmac
import time
from datetime import datetime

from app.config import settings

# Replay protection: reject requests older than this window (in seconds)
TIMESTAMP_WINDOW_SECONDS = 300  # 5 minutes


class HMACVerificationError(Exception):
    """Raised when HMAC verification fails."""

    pass


def verify_hmac_signature(
    device_id: str,
    timestamp: str,
    signature: str,
    body: bytes,
) -> None:
    """
    Verify HMAC-SHA256 signature for ingestion requests.

    The signature is computed as:
        HMAC-SHA256(secret, device_id + timestamp + body)

    Args:
        device_id: X-Device-Id header value
        timestamp: X-Timestamp header value (ISO format or Unix timestamp)
        signature: X-Signature header value (hex-encoded)
        body: Raw request body bytes

    Raises:
        HMACVerificationError: If verification fails
    """
    # Validate timestamp (replay protection)
    try:
        # Try parsing as Unix timestamp first
        try:
            request_time = float(timestamp)
        except ValueError:
            # Try parsing as ISO format
            request_time = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp()

        current_time = time.time()
        time_diff = abs(current_time - request_time)

        if time_diff > TIMESTAMP_WINDOW_SECONDS:
            raise HMACVerificationError(
                f"Request timestamp outside allowed window ({time_diff:.0f}s > {TIMESTAMP_WINDOW_SECONDS}s)"
            )
    except (ValueError, TypeError) as e:
        raise HMACVerificationError(f"Invalid timestamp format: {e}") from None

    # Compute expected signature
    secret = settings.ingestion_hmac_secret.encode("utf-8")
    message = device_id.encode("utf-8") + timestamp.encode("utf-8") + body
    expected_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()

    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(signature.lower(), expected_signature.lower()):
        raise HMACVerificationError("Invalid HMAC signature")


def generate_hmac_signature(
    device_id: str,
    timestamp: str,
    body: bytes,
) -> str:
    """
    Generate HMAC-SHA256 signature for testing/documentation.

    Args:
        device_id: Device identifier
        timestamp: Request timestamp
        body: Request body bytes

    Returns:
        Hex-encoded HMAC-SHA256 signature
    """
    secret = settings.ingestion_hmac_secret.encode("utf-8")
    message = device_id.encode("utf-8") + timestamp.encode("utf-8") + body
    return hmac.new(secret, message, hashlib.sha256).hexdigest()
