"""
Emirates NBD adapter implementation (stub).

This adapter demonstrates the pattern for adding new bank support.
Update the patterns based on actual Emirates NBD message formats.
"""

from app.adapters.base import BankAdapter, ParserMetadata, ParserProtocol
from app.adapters.emirates_nbd.parsers import (
    EmiratesNBDCardPurchaseParser,
    EmiratesNBDCreditParser,
    EmiratesNBDDebitParser,
)


class EmiratesNBDAdapter(BankAdapter):
    """
    Adapter for Emirates NBD (UAE).

    NOTE: This is a stub adapter with placeholder patterns.
    Update patterns based on actual Emirates NBD message formats.

    Planned support:
    - Card purchase notifications
    - Account credit notifications
    - Card/account debit notifications
    """

    @property
    def institution_name(self) -> str:
        return "emirates_nbd"

    @property
    def display_name(self) -> str:
        return "Emirates NBD"

    @property
    def country(self) -> str:
        return "AE"

    @property
    def version(self) -> str:
        # 0.x version indicates stub/beta status
        return "0.1.0"

    @property
    def description(self) -> str:
        return (
            "Emirates NBD UAE - STUB ADAPTER. "
            "Patterns need to be verified against actual message formats. "
            "Supports card purchases, credits, and debits."
        )

    @property
    def sms_sender_patterns(self) -> list[str]:
        # Common sender patterns for UAE banks - verify for Emirates NBD
        return [
            "EMIRATESNBD",
            "EMIRATES NBD",
            "ENBD",
            "E-NBD",
        ]

    @property
    def email_sender_patterns(self) -> list[str]:
        return [
            "@emiratesnbd.com",
            "@enbd.com",
            "noreply@emiratesnbd",
            "alerts@emiratesnbd",
        ]

    @property
    def sms_keywords(self) -> list[str]:
        return [
            "card",
            "transaction",
            "credited",
            "debited",
            "withdrawn",
            "balance",
            "AED",
        ]

    @property
    def email_keywords(self) -> list[str]:
        return [
            "transaction",
            "card",
            "statement",
            "purchase",
            "payment",
            "alert",
        ]

    @property
    def ai_parse_prompt_template(self) -> str | None:
        """Custom prompt template for Emirates NBD AI parsing."""
        return """You are parsing a banking SMS/email notification from Emirates NBD UAE.

Extract the following fields from the message in JSON format:
- amount: numeric transaction amount (required)
- currency: ISO currency code like AED, USD (default: AED)
- direction: "debit" or "credit" (required)
- occurred_at: transaction date/time in ISO 8601 format if available
- vendor_raw: merchant/vendor name if present
- card_last4: last 4 digits of card if mentioned (usually shown as ****1234)
- account_tail: account number suffix if mentioned
- available_balance: available balance after transaction if shown
- reference_id: any reference/auth code if present

Message to parse:
Sender: {{ sender }}
Body: {{ body }}

Respond with ONLY valid JSON, no explanation."""

    def get_parsers(self) -> list[ParserProtocol]:
        """Return list of Emirates NBD parsers."""
        return [
            EmiratesNBDCardPurchaseParser(),
            EmiratesNBDCreditParser(),
            EmiratesNBDDebitParser(),
        ]

    def get_parser_metadata(self) -> list[ParserMetadata]:
        """Return metadata for each parser."""
        return [
            ParserMetadata(
                name="EmiratesNBDCardPurchaseParser",
                description="Parses card purchase SMS (stub - needs verification)",
                message_types=["card_purchase"],
                version="0.1.0",
            ),
            ParserMetadata(
                name="EmiratesNBDCreditParser",
                description="Parses account credit SMS (stub - needs verification)",
                message_types=["credit", "deposit"],
                version="0.1.0",
            ),
            ParserMetadata(
                name="EmiratesNBDDebitParser",
                description="Parses card/account debit SMS (stub - needs verification)",
                message_types=["card_debit", "atm_withdrawal"],
                version="0.1.0",
            ),
        ]
