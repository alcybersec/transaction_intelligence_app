"""
Emirates NBD transaction parsers (stub implementation).

NOTE: These are placeholder patterns. Update with actual Emirates NBD
message formats when available.

Expected Emirates NBD SMS formats (to be verified):
- Card purchase: "Your Emirates NBD Card ****1234 was used for AED 100.00 at MERCHANT"
- Credit: "AED 500.00 credited to your Emirates NBD account ending 5678"
- Debit: "AED 200.00 debited from your Emirates NBD Card ****1234"
"""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from app.schemas.transaction import ParsedTransaction


class EmiratesNBDCardPurchaseParser:
    """
    Parser for Emirates NBD card purchase SMS.

    NOTE: Stub implementation - patterns need to be verified against real messages.
    """

    # Placeholder patterns - update based on actual Emirates NBD format
    CARD_PURCHASE_PATTERN = re.compile(
        r"(?:Your\s+)?(?:Emirates\s+)?NBD\s+(?:Card\s+)?\*{4}(\d{4})\s+"
        r"(?:was\s+)?(?:used|charged)\s+(?:for\s+)?"
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:at\s+)?(.+?)(?:\s+on\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}))?",
        re.IGNORECASE,
    )

    # Alternative pattern
    PURCHASE_ALT_PATTERN = re.compile(
        r"(?:Transaction\s+)?(?:of\s+)?([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:on\s+)?(?:your\s+)?(?:Emirates\s+)?NBD\s+(?:Card\s+)?\*{4}(\d{4})\s+"
        r"(?:at\s+)?(.+)",
        re.IGNORECASE,
    )

    # Balance pattern
    BALANCE_PATTERN = re.compile(
        r"(?:Available|Avl\.?)\s*(?:Balance|Bal\.?|Limit)[:\s]*"
        r"([A-Z]{3})?\s*([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if message is an Emirates NBD card purchase."""
        body_upper = body.upper()
        # Check for purchase indicators
        return (
            any(kw in body_upper for kw in ["CARD", "USED", "CHARGED", "PURCHASE"])
            and any(kw in body_upper for kw in ["AED", "USD", "EUR", "GBP"])
        )

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse Emirates NBD card purchase message."""
        # Try main pattern
        match = self.CARD_PURCHASE_PATTERN.search(body)
        if match:
            card_last4 = match.group(1)
            currency = match.group(2).upper()
            amount_str = match.group(3).replace(",", "")
            vendor_raw = match.group(4).strip()
            date_str = match.group(5) if len(match.groups()) > 4 else None
        else:
            # Try alternative pattern
            match = self.PURCHASE_ALT_PATTERN.search(body)
            if not match:
                return None

            currency = match.group(1).upper()
            amount_str = match.group(2).replace(",", "")
            card_last4 = match.group(3)
            vendor_raw = match.group(4).strip()
            date_str = None

        # Parse amount
        try:
            amount = Decimal(amount_str)
        except InvalidOperation:
            return None

        # Parse date if available
        occurred_at_parsed = observed_at
        if date_str:
            occurred_at_parsed = self._parse_date(date_str, observed_at)

        # Extract balance
        available_balance = None
        bal_match = self.BALANCE_PATTERN.search(body)
        if bal_match:
            try:
                bal_str = bal_match.group(2).replace(",", "")
                available_balance = Decimal(bal_str)
            except (InvalidOperation, IndexError):
                pass

        return ParsedTransaction(
            amount=amount,
            currency=currency,
            direction="debit",
            occurred_at=occurred_at_parsed,
            vendor_raw=vendor_raw,
            card_last4=card_last4,
            available_balance=available_balance,
            institution_name="emirates_nbd",
        )

    def _parse_date(self, date_str: str, observed_at: datetime) -> datetime:
        """Parse date from message."""
        date_formats = ["%d-%b-%Y", "%d/%b/%Y", "%d-%b-%y", "%d/%b/%y", "%d/%m/%Y"]

        for fmt in date_formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if observed_at.tzinfo:
                    parsed = parsed.replace(tzinfo=observed_at.tzinfo)
                return parsed
            except ValueError:
                continue

        return observed_at


class EmiratesNBDCreditParser:
    """
    Parser for Emirates NBD account credit SMS.

    NOTE: Stub implementation - patterns need to be verified against real messages.
    """

    CREDIT_PATTERN = re.compile(
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:has\s+been\s+)?(?:credited|deposited)\s+"
        r"(?:to\s+)?(?:your\s+)?(?:Emirates\s+)?NBD\s+"
        r"(?:account|AC).*?(?:ending\s+)?(\d{3,4})",
        re.IGNORECASE,
    )

    BALANCE_PATTERN = re.compile(
        r"(?:Available|Avl\.?)\s*(?:Balance|Bal\.?)[:\s]*"
        r"([A-Z]{3})?\s*([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if message is an Emirates NBD credit."""
        body_upper = body.upper()
        return any(kw in body_upper for kw in ["CREDITED", "DEPOSITED", "CREDIT"])

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse Emirates NBD credit message."""
        match = self.CREDIT_PATTERN.search(body)
        if not match:
            return None

        currency = match.group(1).upper()
        amount_str = match.group(2).replace(",", "")
        account_tail = match.group(3)

        try:
            amount = Decimal(amount_str)
        except InvalidOperation:
            return None

        # Extract balance
        available_balance = None
        bal_match = self.BALANCE_PATTERN.search(body)
        if bal_match:
            try:
                bal_str = bal_match.group(2).replace(",", "")
                available_balance = Decimal(bal_str)
            except (InvalidOperation, IndexError):
                pass

        return ParsedTransaction(
            amount=amount,
            currency=currency,
            direction="credit",
            occurred_at=observed_at,
            vendor_raw=None,
            account_tail=account_tail,
            available_balance=available_balance,
            institution_name="emirates_nbd",
        )


class EmiratesNBDDebitParser:
    """
    Parser for Emirates NBD card/account debit SMS.

    NOTE: Stub implementation - patterns need to be verified against real messages.
    """

    DEBIT_PATTERN = re.compile(
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:has\s+been\s+)?(?:debited|withdrawn)\s+"
        r"(?:from\s+)?(?:your\s+)?(?:Emirates\s+)?NBD\s+"
        r"(?:Card|Account|AC).*?(?:\*{4}|ending\s+)?(\d{4})",
        re.IGNORECASE,
    )

    BALANCE_PATTERN = re.compile(
        r"(?:Available|Avl\.?)\s*(?:Balance|Bal\.?|Limit)[:\s]*"
        r"([A-Z]{3})?\s*([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if message is an Emirates NBD debit."""
        body_upper = body.upper()
        return any(kw in body_upper for kw in ["DEBITED", "WITHDRAWN", "DEBIT"])

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse Emirates NBD debit message."""
        match = self.DEBIT_PATTERN.search(body)
        if not match:
            return None

        currency = match.group(1).upper()
        amount_str = match.group(2).replace(",", "")
        identifier = match.group(3)

        try:
            amount = Decimal(amount_str)
        except InvalidOperation:
            return None

        # Determine if card or account
        card_last4 = None
        account_tail = None
        if len(identifier) == 4:
            card_last4 = identifier
        else:
            account_tail = identifier

        # Extract balance
        available_balance = None
        bal_match = self.BALANCE_PATTERN.search(body)
        if bal_match:
            try:
                bal_str = bal_match.group(2).replace(",", "")
                available_balance = Decimal(bal_str)
            except (InvalidOperation, IndexError):
                pass

        # Check for ATM withdrawal
        vendor_raw = None
        if "ATM" in body.upper():
            vendor_raw = "ATM WITHDRAWAL"

        return ParsedTransaction(
            amount=amount,
            currency=currency,
            direction="debit",
            occurred_at=observed_at,
            vendor_raw=vendor_raw,
            card_last4=card_last4,
            account_tail=account_tail,
            available_balance=available_balance,
            institution_name="emirates_nbd",
        )
