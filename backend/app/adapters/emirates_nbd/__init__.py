"""
Emirates NBD adapter for transaction parsing.

This is a stub adapter demonstrating how to add support for a new bank.
The regex patterns are placeholders and should be refined based on actual
Emirates NBD SMS/email formats.

To complete this adapter:
1. Obtain sample SMS/email messages from Emirates NBD
2. Update the regex patterns in parsers.py to match actual formats
3. Add test cases with real message examples
4. Update version to 1.0.0 when ready for production
"""

from app.adapters.emirates_nbd.adapter import EmiratesNBDAdapter


def get_adapter() -> EmiratesNBDAdapter:
    """Return Emirates NBD adapter instance for registry."""
    return EmiratesNBDAdapter()


__all__ = ["EmiratesNBDAdapter", "get_adapter"]
