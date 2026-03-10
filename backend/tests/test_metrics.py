"""Prometheus metrics tests."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_metrics_endpoint():
    """Test that /metrics endpoint returns Prometheus format."""
    response = client.get("/metrics")
    assert response.status_code == 200
    # Prometheus metrics should be text format
    assert (
        "text/plain" in response.headers.get("content-type", "")
        or "text/plain" in response.headers.get("Content-Type", "")
        or "openmetrics" in response.headers.get("content-type", "").lower()
    )

    # Check for expected metrics in the response
    content = response.text
    assert "txn_app_info" in content
    assert "txn_http_requests_total" in content
    assert "txn_messages_ingested_total" in content


def test_metrics_module_imports():
    """Test that metrics module exports expected metrics."""
    from app.core.metrics import (
        http_requests_total,
        messages_ingested_total,
        transactions_created_total,
    )

    # Verify these are Prometheus metric types
    assert hasattr(messages_ingested_total, "labels")
    assert hasattr(transactions_created_total, "labels")
    assert hasattr(http_requests_total, "labels")


def test_metrics_can_be_incremented():
    """Test that metrics can be incremented without errors."""
    from app.core.metrics import messages_ingested_total

    # Should not raise an exception
    messages_ingested_total.labels(source="sms", status="test").inc()


def test_get_metrics_returns_bytes():
    """Test that get_metrics() returns bytes."""
    from app.core.metrics import get_metrics

    result = get_metrics()
    assert isinstance(result, bytes)
    assert len(result) > 0
