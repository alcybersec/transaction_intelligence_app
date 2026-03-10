"""
Adapter registry for dynamic bank adapter discovery and management.

The registry automatically discovers adapters from the adapters/ directory
and provides methods to look them up by institution name.
"""

import importlib
from pathlib import Path
from typing import TYPE_CHECKING

from app.core.logging import get_logger

if TYPE_CHECKING:
    from app.adapters.base import AdapterInfo, BankAdapter, ParserProtocol

logger = get_logger(__name__)

# Global registry instance
_registry: "AdapterRegistry | None" = None


class AdapterRegistry:
    """
    Registry for bank adapters.

    Handles auto-discovery and lookup of adapters.

    Usage:
        registry = get_adapter_registry()
        adapter = registry.get_adapter("mashreq")
        parsers = registry.get_all_parsers()
    """

    def __init__(self):
        self._adapters: dict[str, BankAdapter] = {}
        self._discovered = False

    def register(self, adapter: "BankAdapter") -> None:
        """
        Register a bank adapter.

        Args:
            adapter: BankAdapter instance to register

        Raises:
            ValueError: If adapter with same institution_name already registered
        """
        name = adapter.institution_name
        if name in self._adapters:
            logger.warning(f"Adapter '{name}' already registered, replacing with new instance")
        self._adapters[name] = adapter
        logger.info(f"Registered adapter: {adapter.display_name} ({name}) v{adapter.version}")

    def unregister(self, institution_name: str) -> bool:
        """
        Unregister an adapter.

        Args:
            institution_name: Institution identifier

        Returns:
            True if adapter was removed, False if not found
        """
        if institution_name in self._adapters:
            del self._adapters[institution_name]
            logger.info(f"Unregistered adapter: {institution_name}")
            return True
        return False

    def get_adapter(self, institution_name: str) -> "BankAdapter | None":
        """
        Get adapter by institution name.

        Args:
            institution_name: Institution identifier (e.g., "mashreq")

        Returns:
            BankAdapter instance or None if not found
        """
        self._ensure_discovered()
        return self._adapters.get(institution_name)

    def get_all_adapters(self) -> list["BankAdapter"]:
        """
        Get all registered adapters.

        Returns:
            List of all BankAdapter instances
        """
        self._ensure_discovered()
        return list(self._adapters.values())

    def get_adapter_names(self) -> list[str]:
        """
        Get names of all registered adapters.

        Returns:
            List of institution names
        """
        self._ensure_discovered()
        return list(self._adapters.keys())

    def get_adapter_info(self, institution_name: str) -> "AdapterInfo | None":
        """
        Get adapter info for display.

        Args:
            institution_name: Institution identifier

        Returns:
            AdapterInfo or None if not found
        """
        adapter = self.get_adapter(institution_name)
        return adapter.get_info() if adapter else None

    def get_all_adapter_info(self) -> list["AdapterInfo"]:
        """
        Get info for all registered adapters.

        Returns:
            List of AdapterInfo for all adapters
        """
        self._ensure_discovered()
        return [adapter.get_info() for adapter in self._adapters.values()]

    def get_all_parsers(self) -> list["ParserProtocol"]:
        """
        Get all parsers from all registered adapters.

        Returns:
            List of all parser instances
        """
        self._ensure_discovered()
        parsers = []
        for adapter in self._adapters.values():
            parsers.extend(adapter.get_parsers())
        return parsers

    def get_parsers_for_institution(self, institution_name: str) -> list["ParserProtocol"]:
        """
        Get parsers for a specific institution.

        Args:
            institution_name: Institution identifier

        Returns:
            List of parsers for that institution, empty list if not found
        """
        adapter = self.get_adapter(institution_name)
        return adapter.get_parsers() if adapter else []

    def detect_institution_sms(self, sender: str, body: str) -> "BankAdapter | None":
        """
        Detect which adapter should handle an SMS message.

        Args:
            sender: SMS sender
            body: SMS body

        Returns:
            BankAdapter that can handle the message, or None
        """
        self._ensure_discovered()
        for adapter in self._adapters.values():
            if adapter.can_handle_sms(sender, body):
                return adapter
        return None

    def detect_institution_email(
        self, sender: str, subject: str, body: str
    ) -> "BankAdapter | None":
        """
        Detect which adapter should handle an email message.

        Args:
            sender: Email sender address
            subject: Email subject
            body: Email body

        Returns:
            BankAdapter that can handle the message, or None
        """
        self._ensure_discovered()
        for adapter in self._adapters.values():
            if adapter.can_handle_email(sender, subject, body):
                return adapter
        return None

    def discover_adapters(self) -> int:
        """
        Discover and register adapters from the adapters directory.

        Looks for modules with a class that extends BankAdapter
        and has a function `get_adapter()` that returns an instance.

        Returns:
            Number of adapters discovered
        """
        if self._discovered:
            return len(self._adapters)

        # Import adapters package
        import app.adapters as adapters_pkg

        adapters_path = Path(adapters_pkg.__file__).parent
        count = 0

        # Iterate through subdirectories
        for item in adapters_path.iterdir():
            if not item.is_dir():
                continue
            if item.name.startswith("_"):
                continue

            # Check for __init__.py
            init_file = item / "__init__.py"
            if not init_file.exists():
                continue

            module_name = f"app.adapters.{item.name}"

            try:
                # Import the module
                module = importlib.import_module(module_name)

                # Look for get_adapter function
                if hasattr(module, "get_adapter"):
                    adapter = module.get_adapter()
                    if adapter is not None:
                        self.register(adapter)
                        count += 1
                else:
                    logger.debug(f"Module {module_name} has no get_adapter function")

            except Exception as e:
                logger.error(f"Failed to load adapter from {module_name}: {e}")
                continue

        self._discovered = True
        logger.info(f"Adapter discovery complete: {count} adapters loaded")
        return count

    def _ensure_discovered(self) -> None:
        """Ensure adapters have been discovered."""
        if not self._discovered:
            self.discover_adapters()

    def reset(self) -> None:
        """Reset registry (mainly for testing)."""
        self._adapters.clear()
        self._discovered = False

    def __len__(self) -> int:
        self._ensure_discovered()
        return len(self._adapters)

    def __contains__(self, institution_name: str) -> bool:
        self._ensure_discovered()
        return institution_name in self._adapters


def get_adapter_registry() -> AdapterRegistry:
    """
    Get the global adapter registry instance.

    Creates the registry on first call and triggers discovery.

    Returns:
        AdapterRegistry singleton instance
    """
    global _registry
    if _registry is None:
        _registry = AdapterRegistry()
        _registry.discover_adapters()
    return _registry


def reset_adapter_registry() -> None:
    """
    Reset the global adapter registry.

    Mainly useful for testing.
    """
    global _registry
    if _registry is not None:
        _registry.reset()
    _registry = None
