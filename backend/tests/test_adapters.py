"""Tests for the multi-bank adapter system."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.adapters import get_adapter_registry
from app.adapters.base import BankAdapter, ParserProtocol
from app.adapters.mashreq import MashreqAdapter
from app.adapters.mashreq.parsers import (
    MashreqAccountCreditParser,
    MashreqCardDebitParser,
    MashreqCardPurchaseParser,
)
from app.adapters.emirates_nbd import EmiratesNBDAdapter
from app.adapters.registry import AdapterRegistry, reset_adapter_registry


class TestAdapterRegistry:
    """Tests for the adapter registry."""

    def setup_method(self):
        """Reset registry before each test."""
        reset_adapter_registry()

    def teardown_method(self):
        """Clean up after each test."""
        reset_adapter_registry()

    def test_registry_discovers_adapters(self):
        """Test that registry auto-discovers adapters."""
        registry = get_adapter_registry()

        # Should have at least Mashreq and Emirates NBD
        assert len(registry) >= 2
        assert "mashreq" in registry
        assert "emirates_nbd" in registry

    def test_get_adapter(self):
        """Test getting an adapter by name."""
        registry = get_adapter_registry()

        adapter = registry.get_adapter("mashreq")
        assert adapter is not None
        assert adapter.institution_name == "mashreq"
        assert adapter.display_name == "Mashreq Bank"

    def test_get_nonexistent_adapter(self):
        """Test getting an adapter that doesn't exist."""
        registry = get_adapter_registry()

        adapter = registry.get_adapter("nonexistent_bank")
        assert adapter is None

    def test_get_all_adapters(self):
        """Test getting all adapters."""
        registry = get_adapter_registry()

        adapters = registry.get_all_adapters()
        assert len(adapters) >= 2

        names = [a.institution_name for a in adapters]
        assert "mashreq" in names
        assert "emirates_nbd" in names

    def test_get_all_parsers(self):
        """Test getting parsers from all adapters."""
        registry = get_adapter_registry()

        parsers = registry.get_all_parsers()
        assert len(parsers) >= 6  # At least 3 from Mashreq + 3 from Emirates NBD

    def test_detect_institution_sms_mashreq(self):
        """Test SMS institution detection for Mashreq."""
        registry = get_adapter_registry()

        adapter = registry.detect_institution_sms(
            "MASHREQ",
            "Your Card ending 1234 was used for AED 50.00 at STORE on 15-Jan-2024."
        )

        assert adapter is not None
        assert adapter.institution_name == "mashreq"

    def test_detect_institution_sms_case_insensitive(self):
        """Test SMS detection is case insensitive."""
        registry = get_adapter_registry()

        adapter = registry.detect_institution_sms(
            "mashreqbank",
            "Your Card ending 1234 was used for AED 50.00 at STORE."
        )

        assert adapter is not None
        assert adapter.institution_name == "mashreq"

    def test_detect_institution_sms_unknown(self):
        """Test SMS detection returns None for unknown sender."""
        registry = get_adapter_registry()

        adapter = registry.detect_institution_sms(
            "UNKNOWN_BANK",
            "Some banking message"
        )

        assert adapter is None

    def test_register_adapter(self):
        """Test manual adapter registration."""
        registry = AdapterRegistry()

        class TestAdapter(BankAdapter):
            @property
            def institution_name(self) -> str:
                return "test_bank"

            @property
            def display_name(self) -> str:
                return "Test Bank"

            @property
            def country(self) -> str:
                return "XX"

            @property
            def sms_sender_patterns(self) -> list[str]:
                return ["TESTBANK"]

            @property
            def email_sender_patterns(self) -> list[str]:
                return []

            def get_parsers(self) -> list[ParserProtocol]:
                return []

        adapter = TestAdapter()
        registry.register(adapter)

        assert "test_bank" in registry
        assert registry.get_adapter("test_bank") is not None

    def test_unregister_adapter(self):
        """Test unregistering an adapter."""
        registry = get_adapter_registry()

        # Mashreq should be registered
        assert "mashreq" in registry

        # Unregister it
        result = registry.unregister("mashreq")
        assert result is True
        assert "mashreq" not in registry

    def test_unregister_nonexistent(self):
        """Test unregistering an adapter that doesn't exist."""
        registry = get_adapter_registry()

        result = registry.unregister("nonexistent")
        assert result is False


class TestMashreqAdapter:
    """Tests for the Mashreq adapter."""

    def setup_method(self):
        self.adapter = MashreqAdapter()

    def test_adapter_info(self):
        """Test adapter info properties."""
        assert self.adapter.institution_name == "mashreq"
        assert self.adapter.display_name == "Mashreq Bank"
        assert self.adapter.country == "AE"
        assert "sms" in self.adapter.supported_sources

    def test_adapter_parsers(self):
        """Test adapter returns correct parsers."""
        parsers = self.adapter.get_parsers()

        assert len(parsers) == 3
        parser_names = [p.__class__.__name__ for p in parsers]
        assert "MashreqCardPurchaseParser" in parser_names
        assert "MashreqAccountCreditParser" in parser_names
        assert "MashreqCardDebitParser" in parser_names

    def test_can_handle_sms_valid(self):
        """Test SMS detection for valid Mashreq message."""
        assert self.adapter.can_handle_sms(
            "MASHREQ",
            "Your Card ending 1234 was used for AED 50.00"
        ) is True

    def test_can_handle_sms_invalid_sender(self):
        """Test SMS detection for invalid sender."""
        assert self.adapter.can_handle_sms(
            "OTHERBANK",
            "Your Card ending 1234 was used for AED 50.00"
        ) is False

    def test_sms_sender_patterns(self):
        """Test SMS sender patterns."""
        patterns = self.adapter.sms_sender_patterns
        assert "MASHREQ" in patterns
        assert "MASHREQBANK" in patterns

    def test_email_sender_patterns(self):
        """Test email sender patterns."""
        patterns = self.adapter.email_sender_patterns
        assert any("mashreq" in p.lower() for p in patterns)

    def test_get_info(self):
        """Test getting adapter info."""
        info = self.adapter.get_info()

        assert info.institution_name == "mashreq"
        assert info.display_name == "Mashreq Bank"
        assert info.parser_count == 3

    def test_parser_metadata(self):
        """Test getting parser metadata."""
        metadata = self.adapter.get_parser_metadata()

        assert len(metadata) == 3
        names = [m.name for m in metadata]
        assert "MashreqCardPurchaseParser" in names


class TestEmiratesNBDAdapter:
    """Tests for the Emirates NBD stub adapter."""

    def setup_method(self):
        self.adapter = EmiratesNBDAdapter()

    def test_adapter_is_stub(self):
        """Test that adapter is marked as stub (version 0.x)."""
        assert self.adapter.version.startswith("0.")

    def test_adapter_info(self):
        """Test adapter info properties."""
        assert self.adapter.institution_name == "emirates_nbd"
        assert self.adapter.display_name == "Emirates NBD"
        assert self.adapter.country == "AE"

    def test_adapter_parsers(self):
        """Test adapter returns parsers."""
        parsers = self.adapter.get_parsers()
        assert len(parsers) == 3

    def test_sms_sender_patterns(self):
        """Test SMS sender patterns."""
        patterns = self.adapter.sms_sender_patterns
        assert any("ENBD" in p.upper() for p in patterns)


class TestMashreqParsers:
    """Tests for Mashreq parsers in adapter module."""

    def test_card_purchase_parser_can_parse(self):
        """Test card purchase parser detection."""
        parser = MashreqCardPurchaseParser()

        assert parser.can_parse(
            "MASHREQ",
            "Card ending 1234 was used for AED 50.00 at STORE"
        ) is True

    def test_card_purchase_parser_parse(self):
        """Test card purchase parser parsing."""
        parser = MashreqCardPurchaseParser()
        observed_at = datetime(2024, 1, 15, 14, 0, tzinfo=UTC)

        result = parser.parse(
            "MASHREQ",
            "Your Card ending 1234 was used for AED 150.50 at CARREFOUR on 15-Jan-2024 14:30. Avl Cr Limit: AED 10,000.00",
            observed_at
        )

        assert result is not None
        assert result.amount == Decimal("150.50")
        assert result.currency == "AED"
        assert result.direction == "debit"
        assert result.card_last4 == "1234"
        assert result.vendor_raw == "CARREFOUR"
        assert result.available_balance == Decimal("10000.00")

    def test_neo_card_parser(self):
        """Test NEO VISA card format parsing."""
        parser = MashreqCardPurchaseParser()
        observed_at = datetime(2026, 1, 26, 19, 7, tzinfo=UTC)

        result = parser.parse(
            "MASHREQ",
            "Thank you for using NEO VISA Debit Card Card ending 5300 for AED 107.50 at SPINNEYS on 26-JAN-2026 07:07 PM. Available Balance is AED 2,861.93",
            observed_at
        )

        assert result is not None
        assert result.amount == Decimal("107.50")
        assert result.card_last4 == "5300"
        assert result.vendor_raw == "SPINNEYS"
        assert result.available_balance == Decimal("2861.93")

    def test_account_credit_parser(self):
        """Test account credit parser."""
        parser = MashreqAccountCreditParser()
        observed_at = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)

        result = parser.parse(
            "MASHREQ",
            "AED 5,000.00 has been credited to your AC No. ending 1234 on 15-Jan-2024. Avl Bal: AED 15,000.00",
            observed_at
        )

        assert result is not None
        assert result.amount == Decimal("5000.00")
        assert result.direction == "credit"
        assert result.account_tail == "1234"
        assert result.available_balance == Decimal("15000.00")

    def test_aani_credit_parser(self):
        """Test Aani instant payment credit parsing."""
        parser = MashreqAccountCreditParser()
        observed_at = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)

        result = parser.parse(
            "MASHREQ",
            "Your AC No:XXXXXXXX8621 is credited with AED 8979.00 for Aani Instant Payments (Local IPP Transfer). Login to Online Banking for details.",
            observed_at
        )

        assert result is not None
        assert result.amount == Decimal("8979.00")
        assert result.direction == "credit"
        assert result.account_tail == "8621"
        assert "Aani" in result.vendor_raw

    def test_card_debit_parser(self):
        """Test card debit parser."""
        parser = MashreqCardDebitParser()
        observed_at = datetime(2024, 1, 15, 14, 0, tzinfo=UTC)

        result = parser.parse(
            "MASHREQ",
            "AED 1,000.00 was debited from your Card ending 1234 on 15-Jan-2024. ATM Withdrawal. Avl Bal: AED 5,000.00",
            observed_at
        )

        assert result is not None
        assert result.amount == Decimal("1000.00")
        assert result.direction == "debit"
        assert result.card_last4 == "1234"
        assert result.vendor_raw == "ATM WITHDRAWAL"


class TestParserProtocolCompliance:
    """Test that all parsers comply with the protocol."""

    def test_mashreq_parsers_implement_protocol(self):
        """Test Mashreq parsers implement ParserProtocol."""
        parsers = [
            MashreqCardPurchaseParser(),
            MashreqAccountCreditParser(),
            MashreqCardDebitParser(),
        ]

        for parser in parsers:
            assert isinstance(parser, ParserProtocol)
            assert hasattr(parser, "can_parse")
            assert hasattr(parser, "parse")
            assert callable(parser.can_parse)
            assert callable(parser.parse)

    def test_all_registered_parsers_implement_protocol(self):
        """Test all registered parsers implement protocol."""
        registry = get_adapter_registry()
        parsers = registry.get_all_parsers()

        for parser in parsers:
            assert isinstance(parser, ParserProtocol)
