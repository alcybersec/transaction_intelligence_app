"""Worker tests."""

from app.config import settings


def test_config_loads():
    """Test that configuration loads correctly."""
    assert settings.redis_url is not None
    assert settings.database_url is not None


def test_placeholder():
    """Placeholder test to ensure test suite runs."""
    assert True
