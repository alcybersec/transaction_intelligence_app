"""Tests for SMS ingestion endpoints."""

import json
import time
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.security import generate_hmac_signature
from app.main import app

client = TestClient(app)


def make_sms_payload(
    device_id: str = "test-device",
    body: str = "Test SMS body",
    sender: str = "TESTBANK",
    observed_at: str | None = None,
    sms_uid: str | None = None,
) -> dict:
    """Create a test SMS payload."""
    return {
        "device_id": device_id,
        "sms_uid": sms_uid,
        "observed_at": observed_at or datetime.now(UTC).isoformat(),
        "sender": sender,
        "body": body,
        "source": "sms",
    }


def make_headers(device_id: str, body: bytes) -> dict:
    """Create HMAC-authenticated headers."""
    timestamp = str(int(time.time()))
    signature = generate_hmac_signature(device_id, timestamp, body)

    return {
        "X-Device-Id": device_id,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "Content-Type": "application/json",
    }


class TestSMSIngestEndpoint:
    """Tests for POST /ingest/sms endpoint."""

    def test_ingest_sms_missing_headers(self):
        """Test that missing HMAC headers return 422."""
        payload = make_sms_payload()

        response = client.post("/ingest/sms", json=payload)

        assert response.status_code == 422

    def test_ingest_sms_invalid_signature(self):
        """Test that invalid signature returns 401."""
        payload = make_sms_payload()
        body = json.dumps(payload).encode()

        headers = {
            "X-Device-Id": "test-device",
            "X-Timestamp": str(int(time.time())),
            "X-Signature": "invalid-signature",
            "Content-Type": "application/json",
        }

        response = client.post("/ingest/sms", content=body, headers=headers)

        assert response.status_code == 401
        assert "Invalid HMAC signature" in response.json()["detail"]

    def test_ingest_sms_expired_timestamp(self):
        """Test that expired timestamp returns 401."""
        payload = make_sms_payload()
        body = json.dumps(payload).encode()

        old_timestamp = str(int(time.time()) - 600)  # 10 minutes ago
        signature = generate_hmac_signature("test-device", old_timestamp, body)

        headers = {
            "X-Device-Id": "test-device",
            "X-Timestamp": old_timestamp,
            "X-Signature": signature,
            "Content-Type": "application/json",
        }

        response = client.post("/ingest/sms", content=body, headers=headers)

        assert response.status_code == 401
        assert "outside allowed window" in response.json()["detail"]

    def test_ingest_sms_device_id_mismatch(self):
        """Test that mismatched device_id returns 400."""
        payload = make_sms_payload(device_id="device-in-body")
        body = json.dumps(payload).encode()
        headers = make_headers("device-in-header", body)

        response = client.post("/ingest/sms", content=body, headers=headers)

        assert response.status_code == 400
        assert "does not match header" in response.json()["detail"]

    def test_ingest_sms_invalid_payload(self):
        """Test that invalid payload returns 422."""
        # Missing required fields
        payload = {"device_id": "test"}
        body = json.dumps(payload).encode()
        headers = make_headers("test", body)

        response = client.post("/ingest/sms", content=body, headers=headers)

        assert response.status_code == 422


class TestSMSBatchIngestEndpoint:
    """Tests for POST /ingest/sms/batch endpoint."""

    def test_ingest_batch_empty_list(self):
        """Test that empty message list returns 422."""
        payload = {"messages": []}
        body = json.dumps(payload).encode()
        headers = make_headers("test-device", body)

        response = client.post("/ingest/sms/batch", content=body, headers=headers)

        assert response.status_code == 422

    def test_ingest_batch_invalid_signature(self):
        """Test that invalid signature returns 401."""
        payload = {"messages": [make_sms_payload()]}
        body = json.dumps(payload).encode()

        headers = {
            "X-Device-Id": "test-device",
            "X-Timestamp": str(int(time.time())),
            "X-Signature": "invalid",
            "Content-Type": "application/json",
        }

        response = client.post("/ingest/sms/batch", content=body, headers=headers)

        assert response.status_code == 401


class TestHealthEndpoint:
    """Tests for health endpoints."""

    def test_simple_health_check(self):
        """Test simple health check (no dependencies)."""
        response = client.get("/health/simple")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "api"
