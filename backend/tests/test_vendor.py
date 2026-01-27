"""Tests for vendor normalization service."""

import pytest

from app.services.vendor import VendorService


class TestVendorNormalization:
    """Tests for vendor name normalization."""

    def test_uppercase_conversion(self):
        """Test that vendor names are uppercased."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("carrefour")

        assert result == "CARREFOUR"

    def test_whitespace_collapse(self):
        """Test that multiple whitespace is collapsed."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("CARREFOUR   CITY    CENTRE")

        assert result == "CARREFOUR CITY CENTRE"

    def test_strip_country_codes(self):
        """Test that country codes are stripped."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("CARREFOUR UAE")

        assert result == "CARREFOUR"

    def test_strip_city_names(self):
        """Test that city names are stripped."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("STARBUCKS DUBAI")

        assert result == "STARBUCKS"

    def test_strip_legal_suffixes(self):
        """Test that legal suffixes are stripped."""
        service = VendorService.__new__(VendorService)

        assert service.normalize("COMPANY LLC") == "COMPANY"
        assert service.normalize("BUSINESS FZE") == "BUSINESS"
        assert service.normalize("FIRM LTD") == "FIRM"

    def test_strip_branch_numbers(self):
        """Test that branch numbers are stripped."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("CARREFOUR - 123")

        assert result == "CARREFOUR"

    def test_strip_store_codes(self):
        """Test that store codes are stripped."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("STARBUCKS 12345")

        assert result == "STARBUCKS"

    def test_preserve_meaningful_words(self):
        """Test that meaningful vendor words are preserved."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("MCDONALDS CITY CENTRE DEIRA")

        # CITY CENTRE might be stripped but MCDONALDS should remain
        assert "MCDONALDS" in result

    def test_empty_string(self):
        """Test handling of empty string."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("")

        assert result == ""

    def test_none_handling(self):
        """Test handling of None input."""
        service = VendorService.__new__(VendorService)

        result = service.normalize(None)

        assert result == ""

    def test_unicode_normalization(self):
        """Test Unicode normalization."""
        service = VendorService.__new__(VendorService)

        # Test with various Unicode characters
        result = service.normalize("CAFÉ EXPRESS")

        assert result == "CAFÉ EXPRESS"

    def test_strip_hash_numbers(self):
        """Test stripping of hash-prefixed numbers."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("STARBUCKS #123")

        assert result == "STARBUCKS"

    def test_combined_noise_removal(self):
        """Test removal of multiple noise tokens."""
        service = VendorService.__new__(VendorService)

        result = service.normalize("CARREFOUR HYPERMARKET DUBAI UAE LLC - 001")

        # Should strip most noise
        assert "LLC" not in result
        assert "001" not in result
        assert "CARREFOUR" in result

    def test_preserve_only_word_if_all_noise(self):
        """Test that at least one word is preserved."""
        service = VendorService.__new__(VendorService)

        # If all words are noise tokens, keep the first one
        result = service.normalize("UAE")

        assert result == "UAE"

    def test_real_world_vendor_names(self):
        """Test normalization of real-world vendor names."""
        service = VendorService.__new__(VendorService)

        test_cases = [
            ("CARREFOUR CITY CENTRE DEIRA DUBAI UAE", "CARREFOUR CITY CENTRE DEIRA"),
            ("NOON DAILY STORE #123", "NOON DAILY"),
            ("AMAZON.AE", "AMAZON.AE"),
            ("UBER *TRIP DUBAI", "UBER *TRIP"),
            ("DELIVEROO*ORDER DUBAI AE", "DELIVEROO*ORDER"),
        ]

        for input_vendor, expected_prefix in test_cases:
            result = service.normalize(input_vendor)
            assert result.startswith(expected_prefix.split()[0]), f"Failed for {input_vendor}"
