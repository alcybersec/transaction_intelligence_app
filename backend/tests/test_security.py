"""Tests for security utilities (HMAC verification)."""

import time

import pytest

from app.core.security import (
    TIMESTAMP_WINDOW_SECONDS,
    HMACVerificationError,
    generate_hmac_signature,
    verify_hmac_signature,
)


class TestHMACSignature:
    """Test HMAC signature generation and verification."""

    def test_valid_signature_passes(self):
        """Test that a valid signature passes verification."""
        device_id = "test-device"
        timestamp = str(int(time.time()))
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, timestamp, body)

        # Should not raise
        verify_hmac_signature(device_id, timestamp, signature, body)

    def test_invalid_signature_fails(self):
        """Test that an invalid signature fails verification."""
        device_id = "test-device"
        timestamp = str(int(time.time()))
        body = b'{"test": "data"}'

        with pytest.raises(HMACVerificationError, match="Invalid HMAC signature"):
            verify_hmac_signature(device_id, timestamp, "invalid-signature", body)

    def test_tampered_body_fails(self):
        """Test that tampering with body fails verification."""
        device_id = "test-device"
        timestamp = str(int(time.time()))
        original_body = b'{"amount": 100}'
        tampered_body = b'{"amount": 1000}'

        signature = generate_hmac_signature(device_id, timestamp, original_body)

        with pytest.raises(HMACVerificationError, match="Invalid HMAC signature"):
            verify_hmac_signature(device_id, timestamp, signature, tampered_body)

    def test_different_device_id_fails(self):
        """Test that different device_id fails verification."""
        timestamp = str(int(time.time()))
        body = b'{"test": "data"}'

        signature = generate_hmac_signature("device-1", timestamp, body)

        with pytest.raises(HMACVerificationError, match="Invalid HMAC signature"):
            verify_hmac_signature("device-2", timestamp, signature, body)

    def test_signature_is_case_insensitive(self):
        """Test that signature comparison is case-insensitive."""
        device_id = "test-device"
        timestamp = str(int(time.time()))
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, timestamp, body)

        # Should work with uppercase
        verify_hmac_signature(device_id, timestamp, signature.upper(), body)

        # Should work with lowercase
        verify_hmac_signature(device_id, timestamp, signature.lower(), body)


class TestTimestampValidation:
    """Test timestamp-based replay protection."""

    def test_current_timestamp_passes(self):
        """Test that current timestamp passes."""
        device_id = "test-device"
        timestamp = str(int(time.time()))
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, timestamp, body)
        verify_hmac_signature(device_id, timestamp, signature, body)

    def test_old_timestamp_fails(self):
        """Test that old timestamp fails (replay protection)."""
        device_id = "test-device"
        old_timestamp = str(int(time.time()) - TIMESTAMP_WINDOW_SECONDS - 60)
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, old_timestamp, body)

        with pytest.raises(HMACVerificationError, match="outside allowed window"):
            verify_hmac_signature(device_id, old_timestamp, signature, body)

    def test_future_timestamp_fails(self):
        """Test that far future timestamp fails."""
        device_id = "test-device"
        future_timestamp = str(int(time.time()) + TIMESTAMP_WINDOW_SECONDS + 60)
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, future_timestamp, body)

        with pytest.raises(HMACVerificationError, match="outside allowed window"):
            verify_hmac_signature(device_id, future_timestamp, signature, body)

    def test_timestamp_within_window_passes(self):
        """Test that timestamp within window passes."""
        device_id = "test-device"
        # Slightly old but within window
        timestamp = str(int(time.time()) - TIMESTAMP_WINDOW_SECONDS + 30)
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, timestamp, body)
        verify_hmac_signature(device_id, timestamp, signature, body)

    def test_iso_timestamp_format(self):
        """Test that ISO timestamp format is accepted."""
        device_id = "test-device"
        timestamp = "2024-01-15T10:30:00Z"
        body = b'{"test": "data"}'

        signature = generate_hmac_signature(device_id, timestamp, body)

        # This will fail due to old timestamp, but we're testing format parsing
        with pytest.raises(HMACVerificationError, match="outside allowed window"):
            verify_hmac_signature(device_id, timestamp, signature, body)

    def test_invalid_timestamp_format_fails(self):
        """Test that invalid timestamp format fails."""
        device_id = "test-device"
        body = b'{"test": "data"}'

        with pytest.raises(HMACVerificationError, match="Invalid timestamp format"):
            verify_hmac_signature(device_id, "not-a-timestamp", "sig", body)


class TestSignatureGeneration:
    """Test signature generation helper."""

    def test_generate_signature_returns_hex(self):
        """Test that generated signature is hex string."""
        signature = generate_hmac_signature("device", "12345", b"body")

        assert isinstance(signature, str)
        assert len(signature) == 64  # SHA-256 hex
        assert all(c in "0123456789abcdef" for c in signature)

    def test_signature_is_deterministic(self):
        """Test that same inputs produce same signature."""
        sig1 = generate_hmac_signature("device", "12345", b"body")
        sig2 = generate_hmac_signature("device", "12345", b"body")

        assert sig1 == sig2

    def test_different_inputs_produce_different_signatures(self):
        """Test that different inputs produce different signatures."""
        sig1 = generate_hmac_signature("device1", "12345", b"body")
        sig2 = generate_hmac_signature("device2", "12345", b"body")
        sig3 = generate_hmac_signature("device1", "12346", b"body")
        sig4 = generate_hmac_signature("device1", "12345", b"body2")

        assert len({sig1, sig2, sig3, sig4}) == 4  # All different
