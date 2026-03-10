"""Worker tests."""

from app.config import settings
from app.core.encryption import decrypt_body, encrypt_body, hash_body


def test_config_loads():
    """Test that configuration loads correctly."""
    assert settings.redis_url is not None
    assert settings.database_url is not None


def test_imap_config_present():
    """Test that IMAP configuration fields are present."""
    assert hasattr(settings, "imap_host")
    assert hasattr(settings, "imap_port")
    assert hasattr(settings, "imap_user")
    assert hasattr(settings, "imap_password")


class TestWorkerEncryption:
    """Test worker encryption utilities (mirrors backend)."""

    def test_encrypt_decrypt_roundtrip(self):
        """Test encryption roundtrip."""
        original = "Transaction email content"
        encrypted = encrypt_body(original)
        decrypted = decrypt_body(encrypted)
        assert decrypted == original

    def test_hash_body(self):
        """Test body hashing."""
        body = "Email body content"
        hash1 = hash_body(body)
        hash2 = hash_body(body)
        assert hash1 == hash2
        assert len(hash1) == 64


class TestIMAPIngesterImport:
    """Test that IMAP ingester can be imported."""

    def test_import_imap_ingester(self):
        """Test that IMAPIngester can be imported."""
        from app.imap import IMAPIngester

        assert IMAPIngester is not None

    def test_ingester_initialization(self):
        """Test IMAPIngester can be initialized."""
        from app.imap import IMAPIngester

        ingester = IMAPIngester()
        assert ingester.host == settings.imap_host
        assert ingester.port == settings.imap_port
