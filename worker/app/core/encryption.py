"""Field-level encryption utilities for raw message bodies."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _get_fernet() -> Fernet:
    """
    Get Fernet instance with encryption key from settings.

    The encryption key should be a 32-byte base64-encoded key.
    If the key is not valid base64, we derive it from the raw string.
    """
    key = settings.encryption_key

    # Try to use the key directly if it's valid base64 Fernet key
    try:
        # Fernet keys are 32 bytes, URL-safe base64 encoded (44 chars with padding)
        if len(key) == 44:
            return Fernet(key.encode())
    except Exception:
        pass

    # Derive a valid Fernet key from the provided string
    # Use SHA-256 to get 32 bytes, then base64 encode
    derived = hashlib.sha256(key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(derived)
    return Fernet(fernet_key)


def encrypt_body(plaintext: str) -> bytes:
    """
    Encrypt a message body using Fernet symmetric encryption.

    Args:
        plaintext: The raw message body to encrypt

    Returns:
        Encrypted bytes that can be stored in the database
    """
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode("utf-8"))


def decrypt_body(ciphertext: bytes) -> str:
    """
    Decrypt an encrypted message body.

    Args:
        ciphertext: The encrypted bytes from the database

    Returns:
        The original plaintext message body
    """
    fernet = _get_fernet()
    return fernet.decrypt(ciphertext).decode("utf-8")


def hash_body(body: str) -> str:
    """
    Generate SHA-256 hash of message body for deduplication.

    Args:
        body: The raw message body

    Returns:
        Hex-encoded SHA-256 hash (64 characters)
    """
    return hashlib.sha256(body.encode("utf-8")).hexdigest()
