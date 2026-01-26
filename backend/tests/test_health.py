"""Health check endpoint tests."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    """Test that root endpoint returns API info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data


def test_simple_health_check():
    """Test simple health check (no dependencies)."""
    response = client.get("/health/simple")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "api"
    assert data["version"] == "0.1.0"
