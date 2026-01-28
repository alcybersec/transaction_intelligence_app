"""
Mashreq Bank adapter implementation.
"""

from app.adapters.base import BankAdapter, ParserMetadata, ParserProtocol
from app.adapters.mashreq.parsers import (
    MashreqAccountCreditParser,
    MashreqCardDebitParser,
    MashreqCardPurchaseParser,
)


class MashreqAdapter(BankAdapter):
    """
    Adapter for Mashreq Bank (UAE).

    Supports parsing of:
    - Card purchase notifications (standard and NEO VISA formats)
    - Account credit notifications (standard and Aani/IPP formats)
    - Card debit notifications (ATM withdrawals, etc.)
    """

    @property
    def institution_name(self) -> str:
        return "mashreq"

    @property
    def display_name(self) -> str:
        return "Mashreq Bank"

    @property
    def country(self) -> str:
        return "AE"

    @property
    def version(self) -> str:
        return "1.1.0"

    @property
    def description(self) -> str:
        return (
            "Mashreq Bank UAE - supports card purchases, credits/deposits, "
            "ATM withdrawals, NEO VISA cards, and Aani instant payments."
        )

    @property
    def sms_sender_patterns(self) -> list[str]:
        return ["MASHREQ", "MASHREQBANK", "MASHREQ BANK"]

    @property
    def email_sender_patterns(self) -> list[str]:
        return [
            "@mashreqbank.com",
            "@mashreq.com",
            "noreply@mashreq",
            "alerts@mashreq",
        ]

    @property
    def sms_keywords(self) -> list[str]:
        return [
            "card ending",
            "used for",
            "credited",
            "debited",
            "withdrawn",
            "available balance",
            "avl",
            "AC No",
        ]

    @property
    def email_keywords(self) -> list[str]:
        return [
            "transaction",
            "card",
            "statement",
            "purchase",
            "payment",
        ]

    @property
    def ai_parse_prompt_template(self) -> str | None:
        """Custom prompt template for Mashreq-specific AI parsing."""
        return """You are parsing a banking SMS/email notification from Mashreq Bank UAE.

Extract the following fields from the message in JSON format:
- amount: numeric transaction amount (required)
- currency: ISO currency code like AED, USD (default: AED)
- direction: "debit" or "credit" (required)
- occurred_at: transaction date/time in ISO 8601 format if available
- vendor_raw: merchant/vendor name if present
- card_last4: last 4 digits of card if mentioned
- account_tail: account number suffix if mentioned
- available_balance: available balance/limit after transaction if shown
- reference_id: any reference/auth code if present

Message to parse:
Sender: {{ sender }}
Body: {{ body }}

Common Mashreq formats:
- Card purchase: "Card ending XXXX was used for AED XX.XX at VENDOR on DATE"
- NEO card: "Thank you for using NEO VISA Debit Card Card ending XXXX for AED XX.XX..."
- Credit: "AED XX.XX has been credited to your AC No. ending XXXX"
- Aani credit: "Your AC No:XXXXXXXX1234 is credited with AED XX.XX for Aani Instant Payments"
- Debit: "AED XX.XX was debited from your Card ending XXXX"

Respond with ONLY valid JSON, no explanation."""

    def get_parsers(self) -> list[ParserProtocol]:
        """Return list of Mashreq parsers."""
        return [
            MashreqCardPurchaseParser(),
            MashreqAccountCreditParser(),
            MashreqCardDebitParser(),
        ]

    def get_parser_metadata(self) -> list[ParserMetadata]:
        """Return metadata for each parser."""
        return [
            ParserMetadata(
                name="MashreqCardPurchaseParser",
                description="Parses card purchase SMS including NEO VISA format",
                message_types=["card_purchase", "neo_purchase"],
                version="1.1.0",
            ),
            ParserMetadata(
                name="MashreqAccountCreditParser",
                description="Parses account credit/deposit SMS including Aani/IPP format",
                message_types=["credit", "deposit", "aani_credit"],
                version="1.1.0",
            ),
            ParserMetadata(
                name="MashreqCardDebitParser",
                description="Parses card debit SMS including ATM withdrawals",
                message_types=["card_debit", "atm_withdrawal"],
                version="1.0.0",
            ),
        ]
