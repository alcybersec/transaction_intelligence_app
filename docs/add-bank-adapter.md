# Adding a New Bank Adapter

This guide explains how to add support for a new bank to the Transaction Intelligence App.

## Overview

Bank adapters are plugins that teach the system how to parse SMS and email notifications from specific banks. Each adapter contains:

1. **Metadata** - Bank name, country, version info
2. **Detection patterns** - Sender patterns to identify messages from this bank
3. **Parsers** - Regex patterns to extract transaction data from messages
4. **AI prompts** (optional) - Custom prompts for AI-based parsing

## Quick Start

1. Create a new directory: `backend/app/adapters/{bank_name}/`
2. Add `__init__.py`, `adapter.py`, and `parsers.py`
3. Implement the adapter class extending `BankAdapter`
4. Add parsers implementing `ParserProtocol`
5. The adapter will be auto-discovered on startup

## Step-by-Step Guide

### 1. Create Directory Structure

```
backend/app/adapters/
└── my_bank/
    ├── __init__.py
    ├── adapter.py
    └── parsers.py
```

### 2. Create `__init__.py`

```python
"""My Bank adapter for transaction parsing."""

from app.adapters.my_bank.adapter import MyBankAdapter

def get_adapter() -> MyBankAdapter:
    """Return adapter instance for registry auto-discovery."""
    return MyBankAdapter()

__all__ = ["MyBankAdapter", "get_adapter"]
```

### 3. Create `parsers.py`

```python
"""My Bank transaction parsers."""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from app.schemas.transaction import ParsedTransaction


class MyBankCardPurchaseParser:
    """Parser for My Bank card purchase SMS."""

    # Define regex patterns based on actual message format
    PURCHASE_PATTERN = re.compile(
        r"Card\s+(\d{4})\s+.*?"
        r"([A-Z]{3})\s*([\d,]+\.?\d*)\s+"
        r"at\s+(.+?)\s+"
        r"on\s+(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})",
        re.IGNORECASE,
    )

    def can_parse(self, sender: str, body: str) -> bool:
        """Check if this parser can handle the message body."""
        body_upper = body.upper()
        return "CARD" in body_upper and "AED" in body_upper

    def parse(
        self, sender: str, body: str, observed_at: datetime
    ) -> ParsedTransaction | None:
        """Parse the message and extract transaction data."""
        match = self.PURCHASE_PATTERN.search(body)
        if not match:
            return None

        try:
            amount = Decimal(match.group(3).replace(",", ""))
        except InvalidOperation:
            return None

        return ParsedTransaction(
            amount=amount,
            currency=match.group(2).upper(),
            direction="debit",
            occurred_at=observed_at,  # Or parse from message
            vendor_raw=match.group(4).strip(),
            card_last4=match.group(1),
            institution_name="my_bank",
        )
```

### 4. Create `adapter.py`

```python
"""My Bank adapter implementation."""

from app.adapters.base import BankAdapter, ParserMetadata, ParserProtocol
from app.adapters.my_bank.parsers import MyBankCardPurchaseParser


class MyBankAdapter(BankAdapter):
    """Adapter for My Bank."""

    @property
    def institution_name(self) -> str:
        return "my_bank"  # Unique identifier (lowercase)

    @property
    def display_name(self) -> str:
        return "My Bank"  # Human-readable name

    @property
    def country(self) -> str:
        return "AE"  # ISO 3166-1 alpha-2

    @property
    def version(self) -> str:
        return "1.0.0"  # Use 0.x for stubs

    @property
    def sms_sender_patterns(self) -> list[str]:
        # Patterns to match SMS sender (case-insensitive)
        return ["MYBANK", "MY BANK", "MY-BANK"]

    @property
    def email_sender_patterns(self) -> list[str]:
        # Patterns to match email sender
        return ["@mybank.com", "noreply@mybank"]

    @property
    def sms_keywords(self) -> list[str]:
        # Optional: keywords to filter SMS
        return ["card", "purchase", "credited", "debited"]

    def get_parsers(self) -> list[ParserProtocol]:
        return [
            MyBankCardPurchaseParser(),
            # Add more parsers for different message types
        ]

    def get_parser_metadata(self) -> list[ParserMetadata]:
        return [
            ParserMetadata(
                name="MyBankCardPurchaseParser",
                description="Parses card purchase SMS",
                message_types=["card_purchase"],
                version="1.0.0",
            ),
        ]
```

## Parser Guidelines

### ParsedTransaction Fields

| Field | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | Transaction amount as Decimal |
| `currency` | Yes | ISO currency code (default: AED) |
| `direction` | Yes | "debit" or "credit" |
| `occurred_at` | No | Transaction time (uses observed_at if not extracted) |
| `vendor_raw` | No | Merchant/vendor name from message |
| `card_last4` | No | Last 4 digits of card |
| `account_tail` | No | Account number suffix |
| `available_balance` | No | Balance after transaction |
| `reference_id` | No | Transaction reference/auth code |
| `institution_name` | No | Your adapter's institution_name |

### Regex Tips

1. **Test with real messages** - Collect sample SMS/emails from the bank
2. **Handle variations** - Banks change formats over time
3. **Use named groups** for complex patterns
4. **Be careful with whitespace** - Use `\s+` or `\s*` appropriately
5. **Handle commas in amounts** - Strip them before parsing

### Multiple Message Types

Create separate parsers for:
- Card purchases
- Credits/deposits
- Debits/withdrawals
- ATM transactions
- Transfer notifications

Each parser's `can_parse()` should distinguish message types.

## Testing

### Unit Tests

Create `backend/tests/test_adapters_mybank.py`:

```python
from datetime import UTC, datetime
from decimal import Decimal
import pytest

from app.adapters.my_bank import MyBankAdapter
from app.adapters.my_bank.parsers import MyBankCardPurchaseParser


class TestMyBankAdapter:
    def setup_method(self):
        self.adapter = MyBankAdapter()

    def test_adapter_info(self):
        assert self.adapter.institution_name == "my_bank"
        assert self.adapter.display_name == "My Bank"

    def test_can_handle_sms(self):
        assert self.adapter.can_handle_sms(
            "MYBANK",
            "Card 1234 used for AED 50.00"
        ) is True


class TestMyBankParsers:
    def test_card_purchase_parser(self):
        parser = MyBankCardPurchaseParser()
        observed_at = datetime(2024, 1, 15, 14, 0, tzinfo=UTC)

        result = parser.parse(
            "MYBANK",
            "Your Card 1234 used for AED 50.00 at STORE on 15-Jan-2024",
            observed_at
        )

        assert result is not None
        assert result.amount == Decimal("50.00")
        assert result.direction == "debit"
```

### Pattern Tester

Use the Pattern Tester in the UI (Settings > Bank Adapters) to test messages against your adapter without creating database records.

## Custom AI Prompts

Override `ai_parse_prompt_template` for bank-specific AI parsing:

```python
@property
def ai_parse_prompt_template(self) -> str | None:
    return """Extract transaction details from this {{ institution_name }} message.

Sender: {{ sender }}
Body: {{ body }}

Common formats for this bank:
- Purchase: "Card 1234 used for AED 50.00 at STORE on DATE"
- Credit: "AED 100.00 credited to account 5678"

Respond with JSON only."""
```

Variables available: `sender`, `body`, `observed_at_str`

## Versioning

- Use **0.x.x** for stub/development adapters
- Use **1.x.x** when patterns are verified with real messages
- Increment minor version for new message format support
- Increment patch for bug fixes

## Checklist

- [ ] Directory created: `adapters/{bank_name}/`
- [ ] `__init__.py` with `get_adapter()` function
- [ ] `adapter.py` with BankAdapter implementation
- [ ] `parsers.py` with at least one parser
- [ ] Tests in `tests/test_adapters_{bank_name}.py`
- [ ] All required properties implemented
- [ ] SMS sender patterns match real messages
- [ ] Parsers handle common message variations
- [ ] Version set appropriately (0.x for stubs)
