"""Parsing service for extracting transaction data from messages."""

import json
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Protocol

from sqlalchemy.orm import Session

from app.db.models import Institution, Message, ParseMode, ParseStatus
from app.schemas.transaction import ParsedTransaction

logger = logging.getLogger(__name__)


class ParserProtocol(Protocol):
    """Protocol for transaction parsers."""

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if this parser can handle the message."""
        ...

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """Parse the message and return extracted data."""
        ...


class MashreqCardPurchaseParser:
    """
    Parser for Mashreq card purchase SMS.

    Example formats:
    1. "Your Mashreq Card ending 1234 was used for AED 50.00 at CARREFOUR on 15-Jan-2024 14:30.
        Avl Cr Limit: AED 10,000.00"
    2. "Thank you for using NEO VISA Debit Card Card ending 5300 for AED 107.50 at SPINNEYS
        on 26-JAN-2026 07:07 PM. Available Balance is AED 2,861.93"
    """

    # Patterns for Mashreq card purchase SMS
    SENDER_PATTERNS = ["MASHREQ", "MASHREQBANK", "MASHREQ BANK"]

    # Main pattern for card purchase
    CARD_PURCHASE_PATTERN = re.compile(
        r"(?:Your\s+)?(?:Mashreq\s+)?Card\s+ending\s+(\d{4})\s+"
        r"(?:was\s+)?used\s+for\s+"
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"at\s+(.+?)\s+"
        r"on\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})(?:\s+(\d{1,2}:\d{2}))?",
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
    # "Thank you for using NEO VISA Debit Card Card ending 5300 for AED 107.50 at SPINNEYS on 26-JAN-2026 07:07 PM"
    NEO_CARD_PATTERN = re.compile(
        r"(?:Thank\s+you\s+for\s+using\s+)?"
        r"(?:NEO\s+)?(?:VISA\s+)?(?:Debit\s+)?Card\s+Card\s+ending\s+(\d{4})\s+"
        r"for\s+([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
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
        sender_upper = sender.upper()
        if not any(p in sender_upper for p in self.SENDER_PATTERNS):
            return False

        # Check for purchase keywords
        body_upper = body.upper()
        return any(
            kw in body_upper
            for kw in ["CARD ENDING", "WAS USED FOR", "USED FOR", "CARD"]
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

    def _parse_date(
        self, date_str: str, time_str: str | None, observed_at: datetime
    ) -> datetime:
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
                        time_parts = time_str.split(":")
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

    Example formats:
    1. "AED 5,000.00 has been credited to your AC No. ending 1234 on 15-Jan-2024.
        Avl Bal: AED 15,000.00"
    2. "Your AC No:XXXXXXXX8621 is credited with AED 8979.00 for Aani Instant Payments
        (Local IPP Transfer). Login to Online Banking for details."
    """

    SENDER_PATTERNS = ["MASHREQ", "MASHREQBANK", "MASHREQ BANK"]

    # Pattern for credit/deposit
    CREDIT_PATTERN = re.compile(
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"(?:has\s+been\s+)?credited\s+"
        r"(?:to\s+)?(?:your\s+)?(?:AC\.?\s*(?:No\.?)?\s*)?(?:ending\s+)?(\d{3,})\s+"
        r"(?:on\s+)?(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})",
        re.IGNORECASE,
    )

    # Aani/IPP credit pattern (newer format)
    # "Your AC No:XXXXXXXX8621 is credited with AED 8979.00 for Aani Instant Payments..."
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
        sender_upper = sender.upper()
        if not any(p in sender_upper for p in self.SENDER_PATTERNS):
            return False

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
            date_str = None

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

    Example format:
    "AED 1,000.00 was debited from your Card ending 1234 on 15-Jan-2024.
    ATM Withdrawal. Avl Bal: AED 5,000.00"
    """

    SENDER_PATTERNS = ["MASHREQ", "MASHREQBANK", "MASHREQ BANK"]

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
        sender_upper = sender.upper()
        if not any(p in sender_upper for p in self.SENDER_PATTERNS):
            return False

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


class ParsingService:
    """
    Main parsing service that coordinates multiple parsers.
    """

    def __init__(self, db: Session):
        self.db = db
        self.parsers: list[ParserProtocol] = [
            MashreqCardPurchaseParser(),
            MashreqAccountCreditParser(),
            MashreqCardDebitParser(),
        ]

    def detect_institution(self, sender: str, body: str) -> Institution | None:
        """
        Detect which institution this message is from.

        Args:
            sender: Message sender
            body: Message body

        Returns:
            Institution if detected, None otherwise
        """
        institutions = self.db.query(Institution).filter(Institution.is_active == True).all()

        for inst in institutions:
            # Check SMS sender patterns
            if inst.sms_sender_patterns:
                try:
                    patterns = json.loads(inst.sms_sender_patterns)
                    sender_upper = sender.upper()
                    if any(p.upper() in sender_upper for p in patterns):
                        return inst
                except json.JSONDecodeError:
                    pass

        return None

    def parse_message(
        self, message: Message, body: str, mode: ParseMode = ParseMode.REGEX
    ) -> tuple[ParsedTransaction | None, str | None]:
        """
        Parse a message using the configured mode.

        Args:
            message: The Message object
            body: Decrypted message body
            mode: Parsing mode to use

        Returns:
            Tuple of (ParsedTransaction or None, error message or None)
        """
        if mode == ParseMode.REGEX:
            return self._parse_regex(message.sender, body, message.observed_at)
        elif mode == ParseMode.OLLAMA:
            return self._parse_ollama(message.sender, body, message.observed_at)
        elif mode == ParseMode.HYBRID:
            # Try regex first, fall back to Ollama
            result, error = self._parse_regex(message.sender, body, message.observed_at)
            if result:
                return result, None
            # Fall back to Ollama
            logger.info(f"Regex parsing failed, falling back to Ollama for message {message.id}")
            return self._parse_ollama(message.sender, body, message.observed_at)

        return None, f"Unknown parse mode: {mode}"

    def _parse_regex(
        self, sender: str, body: str, observed_at: datetime
    ) -> tuple[ParsedTransaction | None, str | None]:
        """Parse using regex parsers."""
        for parser in self.parsers:
            if parser.can_parse(sender, body):
                try:
                    result = parser.parse(sender, body, observed_at)
                    if result:
                        return result, None
                except Exception as e:
                    return None, f"Parser error: {str(e)}"

        return None, "No matching parser found for message"

    def _parse_ollama(
        self, sender: str, body: str, observed_at: datetime
    ) -> tuple[ParsedTransaction | None, str | None]:
        """Parse using Ollama AI."""
        from app.services.ollama import OllamaError, get_ollama_service

        ollama = get_ollama_service()

        if not ollama.is_configured:
            return None, "Ollama is not configured (OLLAMA_BASE_URL not set)"

        try:
            # Call Ollama to parse the transaction
            result = ollama.parse_transaction(
                sender=sender,
                body=body,
                observed_at_str=observed_at.isoformat(),
            )

            # Validate required fields
            if "amount" not in result or "direction" not in result:
                return None, "AI parsing returned incomplete data: missing amount or direction"

            # Convert to ParsedTransaction
            try:
                amount = Decimal(str(result["amount"]))
            except (InvalidOperation, ValueError) as e:
                return None, f"Invalid amount from AI parsing: {e}"

            # Parse occurred_at if provided
            occurred_at_parsed = observed_at
            if result.get("occurred_at"):
                try:
                    # Try parsing ISO format
                    occurred_at_parsed = datetime.fromisoformat(
                        result["occurred_at"].replace("Z", "+00:00")
                    )
                except (ValueError, AttributeError):
                    # Keep observed_at as fallback
                    pass

            # Parse available_balance if provided
            available_balance = None
            if result.get("available_balance") is not None:
                try:
                    available_balance = Decimal(str(result["available_balance"]))
                except (InvalidOperation, ValueError):
                    pass

            parsed = ParsedTransaction(
                amount=amount,
                currency=result.get("currency", "AED"),
                direction=result["direction"],
                occurred_at=occurred_at_parsed,
                vendor_raw=result.get("vendor_raw"),
                card_last4=result.get("card_last4"),
                account_tail=result.get("account_tail"),
                available_balance=available_balance,
                reference_id=result.get("reference_id"),
                institution_name=self._detect_institution_name(sender),
                parse_confidence=0.8,  # AI parsing confidence
            )

            return parsed, None

        except OllamaError as e:
            logger.warning(f"Ollama parsing failed: {e}")
            return None, f"Ollama parsing error: {str(e)}"
        except Exception as e:
            logger.exception(f"Unexpected error in Ollama parsing: {e}")
            return None, f"Unexpected parsing error: {str(e)}"

    def _detect_institution_name(self, sender: str) -> str | None:
        """Detect institution name from sender."""
        sender_upper = sender.upper()
        if "MASHREQ" in sender_upper:
            return "mashreq"
        # Add more institutions as needed
        return None

    def process_pending_messages(self, limit: int = 100) -> dict:
        """
        Process pending messages in batch.

        Args:
            limit: Maximum number of messages to process

        Returns:
            Statistics dict with success/failure counts
        """
        from app.core.encryption import decrypt_body
        from app.services.merge import MergeEngine
        from app.services.vendor import VendorService

        vendor_service = VendorService(self.db)
        merge_engine = MergeEngine(self.db, vendor_service)

        # Get pending messages
        pending = (
            self.db.query(Message)
            .filter(Message.parse_status == ParseStatus.PENDING)
            .order_by(Message.observed_at)
            .limit(limit)
            .all()
        )

        stats = {"total": len(pending), "success": 0, "failed": 0, "needs_review": 0}

        for message in pending:
            try:
                # Decrypt body
                body = decrypt_body(message.raw_body_encrypted)

                # Detect institution
                institution = self.detect_institution(message.sender, body)
                mode = ParseMode.REGEX
                if institution:
                    mode = ParseMode(institution.parse_mode) if institution.parse_mode else ParseMode.REGEX

                # Parse
                parsed, error = self.parse_message(message, body, mode)

                if parsed:
                    # Try to merge/create transaction
                    try:
                        merge_engine.process_parsed_transaction(message, parsed)
                        message.parse_status = ParseStatus.SUCCESS
                        message.parse_mode = mode
                        message.parse_error = None
                        stats["success"] += 1
                    except Exception as e:
                        message.parse_status = ParseStatus.NEEDS_REVIEW
                        message.parse_mode = mode
                        message.parse_error = f"Merge error: {str(e)}"
                        stats["needs_review"] += 1
                else:
                    message.parse_status = ParseStatus.FAILED
                    message.parse_mode = mode
                    message.parse_error = error
                    stats["failed"] += 1

                self.db.commit()

            except Exception as e:
                message.parse_status = ParseStatus.FAILED
                message.parse_error = f"Processing error: {str(e)}"
                stats["failed"] += 1
                self.db.commit()

        return stats
