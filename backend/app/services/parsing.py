"""Parsing service for extracting transaction data from messages."""

import json
from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.adapters import get_adapter_registry
from app.adapters.base import BankAdapter, ParserProtocol
from app.core.logging import get_logger
from app.db.models import Institution, Message, MessageSource, ParseMode, ParseStatus
from app.schemas.transaction import ParsedTransaction

logger = get_logger(__name__)


# Legacy parser imports for backwards compatibility
# These are now in app.adapters.mashreq.parsers
from app.adapters.mashreq.parsers import (
    MashreqAccountCreditParser,
    MashreqCardDebitParser,
    MashreqCardPurchaseParser,
)


class ParsingService:
    """
    Main parsing service that coordinates multiple parsers.

    Uses the adapter registry to dynamically discover and use bank-specific parsers.
    """

    def __init__(self, db: Session):
        self.db = db
        self._registry = get_adapter_registry()

    @property
    def parsers(self) -> list[ParserProtocol]:
        """
        Get all parsers from registered adapters.

        Returns:
            List of all parser instances from all adapters
        """
        return self._registry.get_all_parsers()

    def detect_adapter(
        self, sender: str, body: str, source: MessageSource | str = MessageSource.SMS
    ) -> BankAdapter | None:
        """
        Detect which adapter should handle this message.

        Args:
            sender: Message sender (phone number or email)
            body: Message body
            source: Message source (sms or email)

        Returns:
            BankAdapter if found, None otherwise
        """
        source_str = source.value if isinstance(source, MessageSource) else source

        if source_str == "sms":
            return self._registry.detect_institution_sms(sender, body)
        elif source_str == "email":
            # For email, we need to extract subject if available
            # For now, treat body as containing any subject info
            return self._registry.detect_institution_email(sender, "", body)

        return None

    def detect_institution(
        self,
        sender: str,
        body: str,
        source: MessageSource | str = MessageSource.SMS,
    ) -> Institution | None:
        """
        Detect which institution this message is from.

        First tries the adapter registry for dynamic detection,
        then falls back to database institution patterns.

        Args:
            sender: Message sender
            body: Message body
            source: Message source (sms or email)

        Returns:
            Institution if detected, None otherwise
        """
        source_str = source.value if isinstance(source, MessageSource) else source

        # First, try adapter-based detection
        adapter = self.detect_adapter(sender, body, source_str)
        if adapter:
            # Look up institution in database
            inst = (
                self.db.query(Institution)
                .filter(Institution.name == adapter.institution_name)
                .filter(Institution.is_active == True)
                .first()
            )
            if inst:
                return inst

            # Create institution record if adapter found but no DB record
            logger.info(
                f"Creating institution record for adapter: {adapter.institution_name}"
            )
            inst = Institution(
                name=adapter.institution_name,
                display_name=adapter.display_name,
                sms_sender_patterns=json.dumps(adapter.sms_sender_patterns),
                email_sender_patterns=json.dumps(adapter.email_sender_patterns),
                parse_mode="regex",
                is_active=True,
            )
            self.db.add(inst)
            self.db.flush()
            return inst

        # Fall back to database-based detection
        institutions = (
            self.db.query(Institution).filter(Institution.is_active == True).all()
        )

        for inst in institutions:
            # Check SMS sender patterns
            if source_str == "sms" and inst.sms_sender_patterns:
                try:
                    patterns = json.loads(inst.sms_sender_patterns)
                    sender_upper = sender.upper()
                    if any(p.upper() in sender_upper for p in patterns):
                        return inst
                except json.JSONDecodeError:
                    pass

            # Check email sender patterns
            if source_str == "email" and inst.email_sender_patterns:
                try:
                    patterns = json.loads(inst.email_sender_patterns)
                    sender_lower = sender.lower()
                    if any(p.lower() in sender_lower for p in patterns):
                        return inst
                except json.JSONDecodeError:
                    pass

        return None

    def get_parsers_for_institution(
        self, institution_name: str | None
    ) -> list[ParserProtocol]:
        """
        Get parsers for a specific institution.

        Args:
            institution_name: Institution identifier or None for all parsers

        Returns:
            List of parsers for the institution
        """
        if institution_name:
            parsers = self._registry.get_parsers_for_institution(institution_name)
            if parsers:
                return parsers

        # Fall back to all parsers
        return self.parsers

    def parse_message(
        self,
        message: Message,
        body: str,
        mode: ParseMode = ParseMode.REGEX,
        institution_name: str | None = None,
    ) -> tuple[ParsedTransaction | None, str | None]:
        """
        Parse a message using the configured mode.

        Args:
            message: The Message object
            body: Decrypted message body
            mode: Parsing mode to use
            institution_name: Optional institution to use specific parsers

        Returns:
            Tuple of (ParsedTransaction or None, error message or None)
        """
        if mode == ParseMode.REGEX:
            return self._parse_regex(
                message.sender, body, message.observed_at, institution_name
            )
        elif mode == ParseMode.OLLAMA:
            return self._parse_ollama(
                message.sender, body, message.observed_at, institution_name
            )
        elif mode == ParseMode.HYBRID:
            # Try regex first, fall back to Ollama
            result, error = self._parse_regex(
                message.sender, body, message.observed_at, institution_name
            )
            if result:
                return result, None
            # Fall back to Ollama
            logger.info(
                f"Regex parsing failed, falling back to Ollama for message {message.id}"
            )
            return self._parse_ollama(
                message.sender, body, message.observed_at, institution_name
            )

        return None, f"Unknown parse mode: {mode}"

    def _parse_regex(
        self,
        sender: str,
        body: str,
        observed_at: datetime,
        institution_name: str | None = None,
    ) -> tuple[ParsedTransaction | None, str | None]:
        """
        Parse using regex parsers.

        Args:
            sender: Message sender
            body: Message body
            observed_at: When message was received
            institution_name: Optional institution to limit parsers

        Returns:
            Tuple of (ParsedTransaction or None, error message or None)
        """
        parsers = self.get_parsers_for_institution(institution_name)

        for parser in parsers:
            if parser.can_parse(sender, body):
                try:
                    result = parser.parse(sender, body, observed_at)
                    if result:
                        return result, None
                except Exception as e:
                    logger.exception(f"Parser {parser.__class__.__name__} error: {e}")
                    return None, f"Parser error: {str(e)}"

        return None, "No matching parser found for message"

    def _parse_ollama(
        self,
        sender: str,
        body: str,
        observed_at: datetime,
        institution_name: str | None = None,
    ) -> tuple[ParsedTransaction | None, str | None]:
        """
        Parse using Ollama AI.

        Args:
            sender: Message sender
            body: Message body
            observed_at: When message was received
            institution_name: Optional institution for custom prompt

        Returns:
            Tuple of (ParsedTransaction or None, error message or None)
        """
        from app.services.ollama import OllamaError, get_ollama_service

        ollama = get_ollama_service()

        if not ollama.is_configured:
            return None, "Ollama is not configured (OLLAMA_BASE_URL not set)"

        try:
            # Get custom prompt template if available
            custom_prompt = None
            if institution_name:
                adapter = self._registry.get_adapter(institution_name)
                if adapter and adapter.ai_parse_prompt_template:
                    custom_prompt = adapter.ai_parse_prompt_template

            # Call Ollama to parse the transaction
            result = ollama.parse_transaction(
                sender=sender,
                body=body,
                observed_at_str=observed_at.isoformat(),
                custom_prompt=custom_prompt,
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

            # Use detected institution or adapter's institution
            inst_name = institution_name or self._detect_institution_name(sender)

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
                institution_name=inst_name,
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
        """
        Detect institution name from sender using adapters.

        Args:
            sender: Message sender

        Returns:
            Institution name or None
        """
        # Try adapter detection
        adapter = self._registry.detect_institution_sms(sender, "")
        if adapter:
            return adapter.institution_name

        # Legacy fallback
        sender_upper = sender.upper()
        if "MASHREQ" in sender_upper:
            return "mashreq"
        if "EMIRATES" in sender_upper or "ENBD" in sender_upper:
            return "emirates_nbd"

        return None

    def _is_potential_reversal(self, body: str) -> bool:
        """
        Check if a message body indicates a reversal/refund transaction.

        Args:
            body: Message body text

        Returns:
            True if the message likely represents a reversal/refund
        """
        reversal_keywords = [
            "refund",
            "reversal",
            "reversed",
            "return",
            "returned",
            "cancelled",
            "canceled",
            "chargeback",
            "credit back",
            "credited back",
            "money back",
            "cashback",
        ]
        body_lower = body.lower()
        return any(keyword in body_lower for keyword in reversal_keywords)

    def process_single_message(self, message_id) -> dict:
        """
        Process a single message by ID.

        Called by background tasks after ingest to auto-parse new messages.

        Args:
            message_id: UUID of the message to process

        Returns:
            Statistics dict with processing result
        """
        from uuid import UUID

        from app.core.encryption import decrypt_body
        from app.services.merge import MergeEngine
        from app.services.vendor import VendorService

        # Ensure message_id is a UUID
        if isinstance(message_id, str):
            message_id = UUID(message_id)

        vendor_service = VendorService(self.db)
        merge_engine = MergeEngine(self.db, vendor_service)

        stats = {"success": False, "error": None, "reversal_linked": False}

        message = (
            self.db.query(Message)
            .filter(Message.id == message_id)
            .first()
        )

        if not message:
            stats["error"] = f"Message {message_id} not found"
            return stats

        if message.parse_status != ParseStatus.PENDING:
            # Already processed
            stats["error"] = f"Message already has status {message.parse_status.value}"
            return stats

        try:
            # Decrypt body
            body = decrypt_body(message.raw_body_encrypted)

            # Detect institution
            source = message.source if message.source else MessageSource.SMS
            institution = self.detect_institution(message.sender, body, source)

            mode = ParseMode.REGEX
            institution_name = None
            if institution:
                # Use source-specific parse mode
                source_str = source.value if hasattr(source, "value") else str(source)
                mode = ParseMode(institution.get_parse_mode(source_str))
                institution_name = institution.name

            # Parse with institution context
            parsed, error = self.parse_message(message, body, mode, institution_name)

            if parsed:
                try:
                    txn_group = merge_engine.process_parsed_transaction(message, parsed)
                    message.parse_status = ParseStatus.SUCCESS
                    message.parse_mode = mode
                    message.parse_error = None
                    stats["success"] = True

                    # Check for reversal
                    if self._is_potential_reversal(body):
                        original = merge_engine.find_reversal_candidate(txn_group)
                        if original:
                            merge_engine.link_reversal(txn_group, original)
                            stats["reversal_linked"] = True
                            logger.info(
                                "linked_reversal",
                                reversal_id=str(txn_group.id),
                                original_id=str(original.id),
                            )
                except Exception as e:
                    message.parse_status = ParseStatus.NEEDS_REVIEW
                    message.parse_mode = mode
                    message.parse_error = f"Merge error: {str(e)}"
                    stats["error"] = f"Merge error: {str(e)}"
            else:
                message.parse_status = ParseStatus.FAILED
                message.parse_mode = mode
                message.parse_error = error
                stats["error"] = error

            self.db.commit()

        except Exception as e:
            logger.exception("error_processing_message", message_id=str(message_id), error=str(e))
            message.parse_status = ParseStatus.FAILED
            message.parse_error = f"Processing error: {str(e)}"
            stats["error"] = str(e)
            self.db.commit()

        return stats

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

                # Detect institution (now supports SMS and email)
                source = message.source if message.source else MessageSource.SMS
                institution = self.detect_institution(message.sender, body, source)

                mode = ParseMode.REGEX
                institution_name = None
                if institution:
                    # Use source-specific parse mode
                    source_str = source.value if hasattr(source, "value") else str(source)
                    mode = ParseMode(institution.get_parse_mode(source_str))
                    institution_name = institution.name

                # Parse with institution context
                parsed, error = self.parse_message(
                    message, body, mode, institution_name
                )

                if parsed:
                    # Try to merge/create transaction
                    try:
                        txn_group = merge_engine.process_parsed_transaction(message, parsed)
                        message.parse_status = ParseStatus.SUCCESS
                        message.parse_mode = mode
                        message.parse_error = None
                        stats["success"] += 1

                        # Check if this is a potential reversal/refund
                        if self._is_potential_reversal(body):
                            original = merge_engine.find_reversal_candidate(txn_group)
                            if original:
                                merge_engine.link_reversal(txn_group, original)
                                logger.info(
                                    "linked_reversal",
                                    reversal_id=str(txn_group.id),
                                    original_id=str(original.id),
                                )
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
                logger.exception(f"Error processing message {message.id}: {e}")
                message.parse_status = ParseStatus.FAILED
                message.parse_error = f"Processing error: {str(e)}"
                stats["failed"] += 1
                self.db.commit()

        return stats

    def test_pattern(
        self, sender: str, body: str, source: str = "sms"
    ) -> dict:
        """
        Test which adapter/parser matches a sample message.

        Args:
            sender: Sample sender
            body: Sample body
            source: Message source (sms or email)

        Returns:
            Dict with detection results
        """
        result = {
            "adapter_detected": None,
            "institution_name": None,
            "parsers_matched": [],
            "parse_result": None,
            "parse_error": None,
        }

        # Detect adapter
        adapter = self.detect_adapter(sender, body, source)
        if adapter:
            result["adapter_detected"] = adapter.display_name
            result["institution_name"] = adapter.institution_name

            # Try each parser
            from datetime import datetime, timezone

            observed_at = datetime.now(timezone.utc)
            for parser in adapter.get_parsers():
                if parser.can_parse(sender, body):
                    result["parsers_matched"].append(parser.__class__.__name__)
                    try:
                        parsed = parser.parse(sender, body, observed_at)
                        if parsed:
                            result["parse_result"] = parsed.model_dump(mode="json")
                            break
                    except Exception as e:
                        result["parse_error"] = str(e)

        return result
