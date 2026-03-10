"""
Mashreq Bank transaction parsers.

Contains regex parsers for different Mashreq SMS formats:
- Card purchases (standard and NEO VISA)
- Account credits (standard and Aani/IPP)
- Card debits (ATM withdrawals)
"""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from app.schemas.transaction import ParsedTransaction


class MashreqCardPurchaseParser:
    """
    Parser for Mashreq card purchase SMS.

    Supported formats:
    1. Standard: "Your Mashreq Card ending 1234 was used for AED 50.00 at CARREFOUR on 15-Jan-2024 14:30.
        Avl Cr Limit: AED 10,000.00"
    2. NEO VISA: "Thank you for using NEO VISA Debit Card Card ending 5300 for AED 107.50 at SPINNEYS
        on 26-JAN-2026 07:07 PM. Available Balance is AED 2,861.93"
    """

    # Main pattern for card purchase
    # Handles: "Card ending 1234 was used for AED 50.00" and "Card ending with 1234 was used for a purchase of AED 50.00"
    CARD_PURCHASE_PATTERN = re.compile(
        r"(?:Your\s+)?(?:Mashreq\s+)?Card\s+ending\s+(?:with\s+)?(\d{4})\s+"
        r"(?:was\s+)?used\s+(?:for\s+)?(?:a\s+purchase\s+of\s+)?"
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"at\s+(.+?)\s+"
        r"on\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})(?:\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?))?",
        re.IGNORECASE,
    )

    # Alternative pattern (different word order)
    CARD_PURCHASE_ALT_PATTERN = re.compile(
        r"(?:Mashreq\s+)?Card\s+(?:ending\s+)?(\d{4})\s+"
        r"(?:has\s+been\s+)?(?:used|charged)\s+"
        r"(?:for\s+)?([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:at\s+)?(.+?)\s+"
        r"(?:on\s+)?(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})",
        re.IGNORECASE,
    )

    # NEO VISA Debit Card pattern (newer format)
    # Handles: "NEO VISA Debit Card Card ending with 5300 was used for a purchase of AED 58.54"
    NEO_CARD_PATTERN = re.compile(
        r"(?:Thank\s+you\s+for\s+using\s+)?"
        r"(?:NEO\s+)?(?:VISA\s+)?(?:Debit\s+)?Card\s+(?:Card\s+)?ending\s+(?:with\s+)?(\d{4})\s+"
        r"(?:was\s+used\s+)?(?:for\s+)?(?:a\s+purchase\s+of\s+)?"
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"at\s+(.+?)\s+"
        r"on\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)",
        re.IGNORECASE,
    )

    # Pattern for available limit/balance
    LIMIT_PATTERN = re.compile(
        r"(?:Avl\.?\s*(?:Cr\.?\s*)?Limit|Available\s+(?:Credit\s+)?Limit|Available\s+Balance(?:\s+is)?)[:\s]*"
        r"([A-Z]{3})?\s*([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    # Pattern for reference/auth code
    REF_PATTERN = re.compile(
        r"(?:Ref\.?|Auth\.?\s*(?:Code)?|Approval\s*(?:Code)?|Txn\s*(?:Ref)?)[:\s]*([A-Z0-9]{6,})",
        re.IGNORECASE,
    )

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if message is a Mashreq card purchase."""
        # Note: Sender check is handled by the adapter, but we double-check here
        body_upper = body.upper()
        return any(
            kw in body_upper for kw in ["CARD ENDING", "WAS USED FOR", "USED FOR", "CARD"]
        ) and any(kw in body_upper for kw in ["AED", "USD", "EUR", "GBP"])

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse Mashreq card purchase message."""
        # Try NEO card pattern first (newer format)
        match = self.NEO_CARD_PATTERN.search(body)
        if match:
            card_last4 = match.group(1)
            currency = match.group(2).upper()
            amount_str = match.group(3).replace(",", "")
            vendor_raw = match.group(4).strip()
            date_str = match.group(5)
            time_str = match.group(6)
        else:
            # Try main pattern
            match = self.CARD_PURCHASE_PATTERN.search(body)
            if not match:
                match = self.CARD_PURCHASE_ALT_PATTERN.search(body)

            if not match:
                return None

            card_last4 = match.group(1)
            currency = match.group(2).upper()
            amount_str = match.group(3).replace(",", "")
            vendor_raw = match.group(4).strip()
            date_str = match.group(5)
            time_str = match.group(6) if len(match.groups()) > 5 else None

        # Parse amount
        try:
            amount = Decimal(amount_str)
        except InvalidOperation:
            return None

        # Parse date
        occurred_at = self._parse_date(date_str, time_str, observed_at)

        # Extract available limit
        available_balance = None
        limit_match = self.LIMIT_PATTERN.search(body)
        if limit_match:
            try:
                limit_str = limit_match.group(2).replace(",", "")
                available_balance = Decimal(limit_str)
            except (InvalidOperation, IndexError):
                pass

        # Extract reference
        reference_id = None
        ref_match = self.REF_PATTERN.search(body)
        if ref_match:
            reference_id = ref_match.group(1)

        return ParsedTransaction(
            amount=amount,
            currency=currency,
            direction="debit",
            occurred_at=occurred_at,
            vendor_raw=vendor_raw,
            card_last4=card_last4,
            available_balance=available_balance,
            reference_id=reference_id,
            institution_name="mashreq",
        )

    def _parse_date(self, date_str: str, time_str: str | None, observed_at: datetime) -> datetime:
        """Parse date/time from message."""
        # Common date formats: 15-Jan-2024, 15/Jan/24, 15-Jan-24
        date_formats = [
            "%d-%b-%Y",
            "%d/%b/%Y",
            "%d-%b-%y",
            "%d/%b/%y",
        ]

        for fmt in date_formats:
            try:
                parsed = datetime.strptime(date_str, fmt)

                # Add time if available
                if time_str:
                    try:
                        # Handle AM/PM format
                        time_clean = time_str.strip()
                        if "AM" in time_clean.upper() or "PM" in time_clean.upper():
                            time_clean = time_clean.upper().replace(" ", "")
                            try:
                                time_parsed = datetime.strptime(time_clean, "%I:%M%p")
                                parsed = parsed.replace(
                                    hour=time_parsed.hour, minute=time_parsed.minute
                                )
                            except ValueError:
                                time_parts = (
                                    time_clean.replace("AM", "").replace("PM", "").split(":")
                                )
                                hour = int(time_parts[0])
                                minute = int(time_parts[1]) if len(time_parts) > 1 else 0
                                if "PM" in time_str.upper() and hour != 12:
                                    hour += 12
                                elif "AM" in time_str.upper() and hour == 12:
                                    hour = 0
                                parsed = parsed.replace(hour=hour, minute=minute)
                        else:
                            time_parts = time_clean.split(":")
                            parsed = parsed.replace(
                                hour=int(time_parts[0]), minute=int(time_parts[1])
                            )
                    except (ValueError, IndexError):
                        pass

                # Use observed_at timezone
                if observed_at.tzinfo:
                    parsed = parsed.replace(tzinfo=observed_at.tzinfo)

                return parsed
            except ValueError:
                continue

        # Fall back to observed_at
        return observed_at


class MashreqAccountCreditParser:
    """
    Parser for Mashreq account credit/deposit SMS.

    Supported formats:
    1. Standard: "AED 5,000.00 has been credited to your AC No. ending 1234 on 15-Jan-2024.
        Avl Bal: AED 15,000.00"
    2. Aani/IPP: "Your AC No:XXXXXXXX8621 is credited with AED 8979.00 for Aani Instant Payments
        (Local IPP Transfer). Login to Online Banking for details."
    """

    # Pattern for credit/deposit
    CREDIT_PATTERN = re.compile(
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:has\s+been\s+)?credited\s+"
        r"(?:to\s+)?(?:your\s+)?(?:AC\.?\s*(?:No\.?)?\s*)?(?:ending\s+)?(\d{3,})\s+"
        r"(?:on\s+)?(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})",
        re.IGNORECASE,
    )

    # Aani/IPP credit pattern (newer format)
    AANI_CREDIT_PATTERN = re.compile(
        r"(?:Your\s+)?AC\s*No[:\s]*[X]+(\d{4})\s+"
        r"is\s+credited\s+with\s+"
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"for\s+(.+?)(?:\.\s*Login|$)",
        re.IGNORECASE,
    )

    # Alternative pattern
    CREDIT_ALT_PATTERN = re.compile(
        r"(?:Amount\s+)?([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:is\s+)?(?:credited|deposited)\s+"
        r"(?:in|to)\s+(?:your\s+)?(?:account|AC)",
        re.IGNORECASE,
    )

    # Pattern for available balance
    BALANCE_PATTERN = re.compile(
        r"(?:Avl\.?\s*Bal\.?|Available\s+Balance|Bal\.?)[:\s]*"
        r"([A-Z]{3})?\s*([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    # Pattern for account tail
    ACCOUNT_PATTERN = re.compile(
        r"(?:AC\.?\s*(?:No\.?)?\s*|Account\s*(?:No\.?)?\s*)(?:ending\s+)?(\d{3,})",
        re.IGNORECASE,
    )

    # Pattern for sender/source
    FROM_PATTERN = re.compile(r"(?:from|by)\s+([A-Za-z0-9\s]+?)(?:\s+on|\s+Ref|$)", re.IGNORECASE)

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if message is a Mashreq account credit."""
        body_upper = body.upper()
        return any(kw in body_upper for kw in ["CREDITED", "DEPOSITED", "CREDIT"])

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse Mashreq credit message."""
        # Try Aani/IPP pattern first (newer format)
        match = self.AANI_CREDIT_PATTERN.search(body)
        if match:
            account_tail = match.group(1)
            currency = match.group(2).upper()
            amount_str = match.group(3).replace(",", "")
            vendor_raw = match.group(4).strip()

            # Parse amount
            try:
                amount = Decimal(amount_str)
            except InvalidOperation:
                return None

            return ParsedTransaction(
                amount=amount,
                currency=currency,
                direction="credit",
                occurred_at=observed_at,
                vendor_raw=vendor_raw,
                account_tail=account_tail,
                available_balance=None,
                institution_name="mashreq",
            )

        # Try main pattern
        match = self.CREDIT_PATTERN.search(body)

        if match:
            currency = match.group(1).upper()
            amount_str = match.group(2).replace(",", "")
            account_tail = match.group(3)
            date_str = match.group(4)
        else:
            # Try alternative pattern
            match = self.CREDIT_ALT_PATTERN.search(body)
            if not match:
                return None

            currency = match.group(1).upper()
            amount_str = match.group(2).replace(",", "")
            account_tail = None
            date_str = None

            # Try to extract account from elsewhere
            acc_match = self.ACCOUNT_PATTERN.search(body)
            if acc_match:
                account_tail = acc_match.group(1)

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

        # Try to extract source/sender as vendor
        vendor_raw = None
        from_match = self.FROM_PATTERN.search(body)
        if from_match:
            vendor_raw = from_match.group(1).strip()

        return ParsedTransaction(
            amount=amount,
            currency=currency,
            direction="credit",
            occurred_at=occurred_at_parsed,
            vendor_raw=vendor_raw,
            account_tail=account_tail,
            available_balance=available_balance,
            institution_name="mashreq",
        )

    def _parse_date(self, date_str: str, observed_at: datetime) -> datetime:
        """Parse date from message."""
        date_formats = ["%d-%b-%Y", "%d/%b/%Y", "%d-%b-%y", "%d/%b/%y"]

        for fmt in date_formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if observed_at.tzinfo:
                    parsed = parsed.replace(tzinfo=observed_at.tzinfo)
                return parsed
            except ValueError:
                continue

        return observed_at


class MashreqCardDebitParser:
    """
    Parser for Mashreq card debit (ATM withdrawal, etc.) SMS.

    Supported format:
    "AED 1,000.00 was debited from your Card ending 1234 on 15-Jan-2024.
    ATM Withdrawal. Avl Bal: AED 5,000.00"
    """

    DEBIT_PATTERN = re.compile(
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:was\s+)?(?:debited|withdrawn)\s+"
        r"(?:from\s+)?(?:your\s+)?(?:Card|Account|AC).*?"
        r"(?:ending\s+)?(\d{4})",
        re.IGNORECASE,
    )

    BALANCE_PATTERN = re.compile(
        r"(?:Avl\.?\s*(?:Bal\.?|Limit)|Available\s+Balance)[:\s]*"
        r"([A-Z]{3})?\s*([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if message is a Mashreq debit."""
        body_upper = body.upper()
        return any(kw in body_upper for kw in ["DEBITED", "WITHDRAWN", "DEBIT"])

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse Mashreq debit message."""
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

        # Check for ATM/transaction type as vendor
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
            institution_name="mashreq",
        )
