"""
Multi-bank adapter system for transaction parsing.

This module provides a plugin-based architecture for supporting multiple banks.
Each bank adapter defines:
- Detection patterns (SMS/email sender patterns, keywords)
- Regex parsers for different message types
- AI prompt templates for Ollama-based parsing
- Field mapping rules

To add a new bank:
1. Create a new directory under adapters/ (e.g., adapters/my_bank/)
2. Create an adapter class implementing BankAdapter
3. Register parsers via get_parsers()
4. The adapter will be auto-discovered on startup
"""

from app.adapters.base import BankAdapter, ParserProtocol
from app.adapters.registry import AdapterRegistry, get_adapter_registry

__all__ = [
    "BankAdapter",
    "ParserProtocol",
    "AdapterRegistry",
    "get_adapter_registry",
]
