"""
Mashreq Bank adapter for transaction parsing.

Supports:
- Card purchase SMS (standard and NEO VISA formats)
- Account credit/deposit SMS (standard and Aani/IPP formats)
- Card debit SMS (ATM withdrawals, etc.)
"""

from app.adapters.mashreq.adapter import MashreqAdapter

# Export the adapter factory function for auto-discovery
def get_adapter() -> MashreqAdapter:
    """Return Mashreq adapter instance for registry."""
    return MashreqAdapter()


__all__ = ["MashreqAdapter", "get_adapter"]
