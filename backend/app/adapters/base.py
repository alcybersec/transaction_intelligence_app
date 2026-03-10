"""
Base classes and protocols for bank adapters.

This module defines the interface that all bank adapters must implement.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol, runtime_checkable

from app.schemas.transaction import ParsedTransaction


@runtime_checkable
class ParserProtocol(Protocol):
    """
    Protocol for transaction parsers.

    Each parser handles a specific message type (e.g., card purchase, credit, debit).
    """

    def can_parse(self, sender: str, body: str) -> bool:
        """
        Check if this parser can handle the message.

        Args:
            sender: Message sender (phone number or email address)
            body: Message body text

        Returns:
            True if this parser can handle the message
        """
        ...

    def parse(self, sender: str, body: str, observed_at: datetime) -> ParsedTransaction | None:
        """
        Parse the message and return extracted transaction data.

        Args:
            sender: Message sender
            body: Message body text
            observed_at: When the message was received

        Returns:
            ParsedTransaction if successful, None otherwise
        """
        ...


@dataclass
class ParserMetadata:
    """Metadata about a specific parser."""

    name: str
    description: str
    message_types: list[str] = field(
        default_factory=list
    )  # e.g., ["card_purchase", "atm_withdrawal"]
    version: str = "1.0.0"


@dataclass
class AdapterInfo:
    """
    Information about a bank adapter.

    This is returned by the adapter registry for UI display.
    """

    institution_name: str
    display_name: str
    country: str
    version: str
    supported_sources: list[str]  # ["sms", "email"]
    sms_sender_patterns: list[str]
    email_sender_patterns: list[str]
    parser_count: int
    is_active: bool = True
    description: str = ""

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "institution_name": self.institution_name,
            "display_name": self.display_name,
            "country": self.country,
            "version": self.version,
            "supported_sources": self.supported_sources,
            "sms_sender_patterns": self.sms_sender_patterns,
            "email_sender_patterns": self.email_sender_patterns,
            "parser_count": self.parser_count,
            "is_active": self.is_active,
            "description": self.description,
        }


class BankAdapter(ABC):
    """
    Base class for bank adapters.

    Each bank adapter provides:
    - Institution metadata (name, country, etc.)
    - Message detection patterns (sender patterns, keywords)
    - Parsers for different message types
    - AI prompt templates (optional)

    To create a new adapter:
    1. Subclass BankAdapter
    2. Implement all abstract properties and methods
    3. Place in adapters/{institution_name}/ directory
    4. The adapter will be auto-discovered

    Example:
        class MyBankAdapter(BankAdapter):
            @property
            def institution_name(self) -> str:
                return "my_bank"

            @property
            def display_name(self) -> str:
                return "My Bank"

            # ... implement other required methods
    """

    # =========================================================================
    # Required Properties - Must be implemented by subclasses
    # =========================================================================

    @property
    @abstractmethod
    def institution_name(self) -> str:
        """
        Unique identifier for this institution (lowercase, underscores).

        Example: "mashreq", "emirates_nbd", "fab"
        """
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """
        Human-readable name for display in UI.

        Example: "Mashreq Bank", "Emirates NBD"
        """
        ...

    @property
    @abstractmethod
    def country(self) -> str:
        """
        ISO 3166-1 alpha-2 country code.

        Example: "AE" for UAE, "SA" for Saudi Arabia
        """
        ...

    @property
    @abstractmethod
    def sms_sender_patterns(self) -> list[str]:
        """
        List of patterns to match SMS sender.

        Case-insensitive substring matching is used.

        Example: ["MASHREQ", "MASHREQBANK", "MASHREQ BANK"]
        """
        ...

    @property
    @abstractmethod
    def email_sender_patterns(self) -> list[str]:
        """
        List of patterns to match email sender.

        Case-insensitive substring matching is used.

        Example: ["@mashreqbank.com", "noreply@mashreq"]
        """
        ...

    @abstractmethod
    def get_parsers(self) -> list[ParserProtocol]:
        """
        Return list of parsers for this bank.

        Parsers are tried in order until one succeeds.

        Returns:
            List of parser instances implementing ParserProtocol
        """
        ...

    # =========================================================================
    # Optional Properties - Have sensible defaults
    # =========================================================================

    @property
    def version(self) -> str:
        """Adapter version for tracking changes."""
        return "1.0.0"

    @property
    def description(self) -> str:
        """Optional description of this adapter."""
        return ""

    @property
    def supported_sources(self) -> list[str]:
        """
        List of supported message sources.

        Returns:
            List containing "sms", "email", or both
        """
        sources = []
        if self.sms_sender_patterns:
            sources.append("sms")
        if self.email_sender_patterns:
            sources.append("email")
        return sources or ["sms"]  # Default to SMS if no patterns defined

    @property
    def sms_keywords(self) -> list[str]:
        """
        Optional list of keywords to filter SMS messages.

        If defined, message must contain at least one keyword.

        Example: ["purchase", "credited", "debited", "card ending"]
        """
        return []

    @property
    def email_keywords(self) -> list[str]:
        """
        Optional list of keywords to filter email messages.

        Example: ["transaction", "statement", "card"]
        """
        return []

    @property
    def ai_parse_prompt_template(self) -> str | None:
        """
        Optional Jinja2 template for AI parsing prompt.

        Variables available: sender, body, institution_name, examples

        Returns:
            Prompt template string or None to use default
        """
        return None

    @property
    def ai_categorize_prompt_template(self) -> str | None:
        """
        Optional Jinja2 template for AI categorization prompt.

        Variables available: vendor_name, transaction_amount, category_list

        Returns:
            Prompt template string or None to use default
        """
        return None

    # =========================================================================
    # Detection Methods
    # =========================================================================

    def can_handle_sms(self, sender: str, body: str) -> bool:
        """
        Check if this adapter can handle an SMS message.

        Args:
            sender: SMS sender
            body: SMS body

        Returns:
            True if this adapter should handle this message
        """
        sender_upper = sender.upper()

        # Check sender patterns
        if not any(p.upper() in sender_upper for p in self.sms_sender_patterns):
            return False

        # Check keywords if defined
        if self.sms_keywords:
            body_upper = body.upper()
            if not any(kw.upper() in body_upper for kw in self.sms_keywords):
                return False

        return True

    def can_handle_email(self, sender: str, subject: str, body: str) -> bool:
        """
        Check if this adapter can handle an email message.

        Args:
            sender: Email sender address
            subject: Email subject
            body: Email body

        Returns:
            True if this adapter should handle this message
        """
        sender_lower = sender.lower()

        # Check sender patterns
        if not any(p.lower() in sender_lower for p in self.email_sender_patterns):
            return False

        # Check keywords if defined
        if self.email_keywords:
            text = (subject + " " + body).upper()
            if not any(kw.upper() in text for kw in self.email_keywords):
                return False

        return True

    # =========================================================================
    # Info Methods
    # =========================================================================

    def get_info(self) -> AdapterInfo:
        """
        Get adapter information for API/UI display.

        Returns:
            AdapterInfo dataclass with all metadata
        """
        return AdapterInfo(
            institution_name=self.institution_name,
            display_name=self.display_name,
            country=self.country,
            version=self.version,
            supported_sources=self.supported_sources,
            sms_sender_patterns=self.sms_sender_patterns,
            email_sender_patterns=self.email_sender_patterns,
            parser_count=len(self.get_parsers()),
            description=self.description,
        )

    def get_parser_metadata(self) -> list[ParserMetadata]:
        """
        Get metadata for all parsers in this adapter.

        Override this method to provide detailed parser information.

        Returns:
            List of ParserMetadata for each parser
        """
        parsers = self.get_parsers()
        return [
            ParserMetadata(
                name=parser.__class__.__name__,
                description=parser.__doc__ or "No description",
            )
            for parser in parsers
        ]

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(institution={self.institution_name}, version={self.version})>"
