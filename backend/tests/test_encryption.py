"""Tests for encryption utilities."""


from app.core.encryption import decrypt_body, encrypt_body, hash_body


class TestEncryption:
    """Test encryption and decryption functions."""

    def test_encrypt_decrypt_roundtrip(self):
        """Test that encrypting then decrypting returns original text."""
        original = "Your Mashreq Card ending 1234 was used for AED 50.00"
        encrypted = encrypt_body(original)
        decrypted = decrypt_body(encrypted)

        assert decrypted == original

    def test_encrypt_returns_bytes(self):
        """Test that encrypt_body returns bytes."""
        encrypted = encrypt_body("test message")
        assert isinstance(encrypted, bytes)

    def test_decrypt_returns_string(self):
        """Test that decrypt_body returns string."""
        encrypted = encrypt_body("test message")
        decrypted = decrypt_body(encrypted)
        assert isinstance(decrypted, str)

    def test_encryption_is_not_plaintext(self):
        """Test that encrypted data doesn't contain plaintext."""
        original = "secret banking data"
        encrypted = encrypt_body(original)

        # Encrypted bytes should not contain the original text
        assert original.encode() not in encrypted

    def test_different_inputs_produce_different_outputs(self):
        """Test that different inputs produce different encrypted outputs."""
        encrypted1 = encrypt_body("message one")
        encrypted2 = encrypt_body("message two")

        assert encrypted1 != encrypted2

    def test_same_input_produces_different_output_each_time(self):
        """Test that Fernet adds randomness (IV) to encryption."""
        message = "same message"
        encrypted1 = encrypt_body(message)
        encrypted2 = encrypt_body(message)

        # Fernet uses random IV, so outputs should differ
        assert encrypted1 != encrypted2

        # But both should decrypt to the same value
        assert decrypt_body(encrypted1) == decrypt_body(encrypted2) == message

    def test_unicode_handling(self):
        """Test that Unicode characters are handled correctly."""
        original = "Transaction: AED 50.00 at مطعم العربي"
        encrypted = encrypt_body(original)
        decrypted = decrypt_body(encrypted)

        assert decrypted == original

    def test_empty_string(self):
        """Test handling of empty string."""
        original = ""
        encrypted = encrypt_body(original)
        decrypted = decrypt_body(encrypted)

        assert decrypted == original

    def test_long_message(self):
        """Test handling of long messages."""
        original = "A" * 10000
        encrypted = encrypt_body(original)
        decrypted = decrypt_body(encrypted)

        assert decrypted == original


class TestHashBody:
    """Test hash_body function."""

    def test_hash_returns_64_char_hex(self):
        """Test that hash returns 64-character hex string (SHA-256)."""
        result = hash_body("test message")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_same_input_same_hash(self):
        """Test that same input produces same hash."""
        message = "Your card was used for AED 100.00"
        hash1 = hash_body(message)
        hash2 = hash_body(message)

        assert hash1 == hash2

    def test_different_input_different_hash(self):
        """Test that different inputs produce different hashes."""
        hash1 = hash_body("message one")
        hash2 = hash_body("message two")

        assert hash1 != hash2

    def test_hash_is_deterministic(self):
        """Test that hash is deterministic across calls."""
        message = "banking transaction"
        expected = hash_body(message)

        for _ in range(10):
            assert hash_body(message) == expected

    def test_unicode_hashing(self):
        """Test that Unicode is handled correctly in hashing."""
        # Same content should produce same hash
        hash1 = hash_body("AED 50.00 at مطعم")
        hash2 = hash_body("AED 50.00 at مطعم")

        assert hash1 == hash2

    def test_empty_string_hash(self):
        """Test hashing empty string."""
        result = hash_body("")
        assert len(result) == 64
        # SHA-256 of empty string is known
        assert result == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
