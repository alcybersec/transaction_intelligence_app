"""Tests for transaction parsing."""

from datetime import UTC, datetime
from decimal import Decimal

# Import from adapters module (parsers have been moved there)
from app.adapters.mashreq.parsers import (
    MashreqAccountCreditParser,
    MashreqCardDebitParser,
    MashreqCardPurchaseParser,
)


class TestMashreqCardPurchaseParser:
    """Tests for Mashreq card purchase SMS parsing."""

    def setup_method(self):
        self.parser = MashreqCardPurchaseParser()

    def test_can_parse_valid_mashreq_sms(self):
        """Test detection of Mashreq card purchase SMS."""
        sender = "MASHREQ"
        body = "Your Mashreq Card ending 1234 was used for AED 50.00 at CARREFOUR on 15-Jan-2024."

        assert self.parser.can_parse(sender, body) is True

    def test_can_parse_case_insensitive_sender(self):
        """Test sender matching is case-insensitive."""
        sender = "mashreq"
        body = "Card ending 1234 used for AED 50.00 at STORE on 15-Jan-2024."

        assert self.parser.can_parse(sender, body) is True

    def test_parser_checks_body_keywords(self):
        """Test parser checks body for purchase keywords.

        Note: In the adapter architecture, sender checking is done by the
        adapter (MashreqAdapter.can_handle_sms), not the individual parsers.
        Parsers only check if the body matches their expected format.
        """
        # Body without purchase keywords should not match
        body_without_keywords = "Your account balance is AED 5000.00"
        assert self.parser.can_parse("MASHREQ", body_without_keywords) is False

        # Body with purchase keywords should match (regardless of sender)
        body_with_keywords = "Your Card ending 1234 was used for AED 50.00 at CARREFOUR."
        assert self.parser.can_parse("MASHREQ", body_with_keywords) is True

    def test_parse_standard_purchase(self):
        """Test parsing standard card purchase SMS."""
        sender = "MASHREQ"
        body = "Your Mashreq Card ending 1234 was used for AED 150.50 at CARREFOUR CITY CENTRE on 15-Jan-2024 14:30. Avl Cr Limit: AED 10,000.00"
        observed_at = datetime(2024, 1, 15, 14, 35, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.amount == Decimal("150.50")
        assert result.currency == "AED"
        assert result.direction == "debit"
        assert result.card_last4 == "1234"
        assert result.vendor_raw == "CARREFOUR CITY CENTRE"
        assert result.available_balance == Decimal("10000.00")
        assert result.institution_name == "mashreq"

    def test_parse_purchase_without_time(self):
        """Test parsing SMS without time component."""
        sender = "MASHREQ"
        body = "Your Card ending 5678 was used for AED 25.00 at STARBUCKS on 20-Feb-2024. Avl Cr Limit: AED 5,000.00"
        observed_at = datetime(2024, 2, 20, 10, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.amount == Decimal("25.00")
        assert result.card_last4 == "5678"
        assert result.vendor_raw == "STARBUCKS"

    def test_parse_purchase_with_reference(self):
        """Test parsing SMS with reference code."""
        sender = "MASHREQ"
        body = "Your Card ending 1234 was used for AED 100.00 at AMAZON on 15-Jan-2024. Ref: AUTH123456. Avl Cr Limit: AED 9,900.00"
        observed_at = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.reference_id == "AUTH123456"

    def test_parse_large_amount_with_commas(self):
        """Test parsing amounts with thousand separators."""
        sender = "MASHREQ"
        body = "Card ending 1234 was used for AED 12,500.75 at DUBAI MALL STORE on 15-Jan-2024. Avl Cr Limit: AED 100,000.00"
        observed_at = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.amount == Decimal("12500.75")
        assert result.available_balance == Decimal("100000.00")

    def test_parse_usd_currency(self):
        """Test parsing non-AED currency."""
        sender = "MASHREQ"
        body = "Your Card ending 1234 was used for USD 50.00 at ONLINE STORE on 15-Jan-2024."
        observed_at = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.currency == "USD"
        assert result.amount == Decimal("50.00")


class TestMashreqAccountCreditParser:
    """Tests for Mashreq account credit/deposit parsing."""

    def setup_method(self):
        self.parser = MashreqAccountCreditParser()

    def test_can_parse_credit_message(self):
        """Test detection of credit messages."""
        sender = "MASHREQ"
        body = "AED 5,000.00 has been credited to your AC No. ending 1234 on 15-Jan-2024."

        assert self.parser.can_parse(sender, body) is True

    def test_cannot_parse_purchase_message(self):
        """Test rejection of purchase messages."""
        sender = "MASHREQ"
        body = "Your Card ending 1234 was used for AED 50.00 at STORE."

        assert self.parser.can_parse(sender, body) is False

    def test_parse_standard_credit(self):
        """Test parsing standard credit SMS."""
        sender = "MASHREQ"
        body = "AED 5,000.00 has been credited to your AC No. ending 1234 on 15-Jan-2024. Avl Bal: AED 15,000.00"
        observed_at = datetime(2024, 1, 15, 10, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.amount == Decimal("5000.00")
        assert result.currency == "AED"
        assert result.direction == "credit"
        assert result.account_tail == "1234"
        assert result.available_balance == Decimal("15000.00")
        assert result.institution_name == "mashreq"

    def test_parse_credit_with_source(self):
        """Test parsing credit with source information."""
        sender = "MASHREQ"
        body = "AED 1,000.00 credited to your AC ending 5678 from SALARY TRANSFER on 01-Feb-2024. Avl Bal: AED 6,000.00"
        observed_at = datetime(2024, 2, 1, 9, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.amount == Decimal("1000.00")
        assert result.direction == "credit"


class TestMashreqCardDebitParser:
    """Tests for Mashreq card debit parsing."""

    def setup_method(self):
        self.parser = MashreqCardDebitParser()

    def test_can_parse_debit_message(self):
        """Test detection of debit messages."""
        sender = "MASHREQ"
        body = "AED 1,000.00 was debited from your Card ending 1234 on 15-Jan-2024."

        assert self.parser.can_parse(sender, body) is True

    def test_parse_atm_withdrawal(self):
        """Test parsing ATM withdrawal SMS."""
        sender = "MASHREQ"
        body = "AED 1,000.00 was debited from your Card ending 1234 on 15-Jan-2024. ATM Withdrawal. Avl Bal: AED 5,000.00"
        observed_at = datetime(2024, 1, 15, 14, 0, tzinfo=UTC)

        result = self.parser.parse(sender, body, observed_at)

        assert result is not None
        assert result.amount == Decimal("1000.00")
        assert result.direction == "debit"
        assert result.card_last4 == "1234"
        assert result.vendor_raw == "ATM WITHDRAWAL"
        assert result.available_balance == Decimal("5000.00")


class TestParserEdgeCases:
    """Tests for edge cases in parsing."""

    def test_empty_body(self):
        """Test handling of empty message body."""
        parser = MashreqCardPurchaseParser()
        observed_at = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)

        result = parser.parse("MASHREQ", "", observed_at)

        assert result is None

    def test_malformed_amount(self):
        """Test handling of malformed amounts."""
        parser = MashreqCardPurchaseParser()
        body = "Card ending 1234 was used for AED invalid at STORE on 15-Jan-2024."
        observed_at = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)

        result = parser.parse("MASHREQ", body, observed_at)

        assert result is None

    def test_vendor_with_special_characters(self):
        """Test parsing vendor names with special characters."""
        parser = MashreqCardPurchaseParser()
        body = "Card ending 1234 was used for AED 50.00 at MCDONALD'S - DUBAI MALL on 15-Jan-2024."
        observed_at = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)

        result = parser.parse("MASHREQ", body, observed_at)

        assert result is not None
        assert "MCDONALD" in result.vendor_raw.upper()
