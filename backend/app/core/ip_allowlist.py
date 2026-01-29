"""IP allowlist middleware for LAN/Tailscale network restriction.

Restricts API access to specified IP ranges (e.g., local network, Tailscale VPN).

Configuration via environment variable:
    ALLOWED_IP_RANGES=192.168.1.0/24,100.64.0.0/10

Common ranges:
    - 192.168.0.0/16  - Private networks (Class C)
    - 10.0.0.0/8      - Private networks (Class A)
    - 172.16.0.0/12   - Private networks (Class B)
    - 100.64.0.0/10   - Tailscale CGNAT range
    - 127.0.0.0/8     - Localhost (always allowed)
    - ::1/128         - IPv6 localhost (always allowed)
"""

import ipaddress
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)


class IPAllowlistMiddleware(BaseHTTPMiddleware):
    """
    Middleware to restrict access based on client IP address.

    Always allows:
    - Localhost (127.0.0.0/8, ::1)
    - Health and metrics endpoints

    Blocks requests from IPs not in the configured allowlist.
    """

    # Endpoints that bypass IP checks (health checks, metrics)
    BYPASS_PATHS = {"/health", "/metrics", "/"}

    # Localhost ranges (always allowed)
    LOCALHOST_RANGES = [
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("::1/128"),
    ]

    def __init__(self, app, allowed_ranges: list[str] | None = None):
        """
        Initialize the middleware.

        Args:
            app: FastAPI application
            allowed_ranges: List of CIDR ranges to allow (e.g., ["192.168.1.0/24"])
        """
        super().__init__(app)
        self.allowed_networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []

        if allowed_ranges:
            for range_str in allowed_ranges:
                try:
                    network = ipaddress.ip_network(range_str.strip(), strict=False)
                    self.allowed_networks.append(network)
                    logger.info("ip_allowlist_added", network=str(network))
                except ValueError as e:
                    logger.warning("ip_allowlist_invalid_range", range=range_str, error=str(e))

        if self.allowed_networks:
            logger.info(
                "ip_allowlist_enabled",
                network_count=len(self.allowed_networks),
                networks=[str(n) for n in self.allowed_networks],
            )
        else:
            logger.warning("ip_allowlist_empty", message="No valid IP ranges configured")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and check IP allowlist."""
        # Always allow bypass paths
        if request.url.path in self.BYPASS_PATHS:
            return await call_next(request)

        # Get client IP
        client_ip = self._get_client_ip(request)

        if not client_ip:
            logger.warning("ip_allowlist_no_ip", path=request.url.path)
            return JSONResponse(
                status_code=403,
                content={"detail": "Unable to determine client IP"},
            )

        # Check if IP is allowed
        if not self._is_ip_allowed(client_ip):
            logger.warning(
                "ip_allowlist_blocked",
                client_ip=str(client_ip),
                path=request.url.path,
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied: IP not in allowlist"},
            )

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
        """
        Extract client IP from request.

        Handles X-Forwarded-For header for reverse proxy scenarios.
        """
        # Check X-Forwarded-For header (for reverse proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP (original client)
            ip_str = forwarded_for.split(",")[0].strip()
        else:
            # Fall back to direct client IP
            client = request.client
            if not client:
                return None
            ip_str = client.host

        try:
            return ipaddress.ip_address(ip_str)
        except ValueError:
            logger.warning("ip_allowlist_invalid_ip", ip=ip_str)
            return None

    def _is_ip_allowed(self, ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
        """
        Check if an IP address is allowed.

        Args:
            ip: IP address to check

        Returns:
            True if IP is in allowlist or localhost
        """
        # Always allow localhost
        for localhost_net in self.LOCALHOST_RANGES:
            if ip in localhost_net:
                return True

        # Check configured allowlist
        for network in self.allowed_networks:
            try:
                if ip in network:
                    return True
            except TypeError:
                # IPv4/IPv6 mismatch - skip
                continue

        return False


def create_ip_allowlist_middleware(allowed_ranges_str: str | None) -> IPAllowlistMiddleware | None:
    """
    Factory function to create IP allowlist middleware from config string.

    Args:
        allowed_ranges_str: Comma-separated CIDR ranges (e.g., "192.168.1.0/24,100.64.0.0/10")

    Returns:
        IPAllowlistMiddleware instance or None if no ranges configured
    """
    if not allowed_ranges_str:
        return None

    ranges = [r.strip() for r in allowed_ranges_str.split(",") if r.strip()]
    if not ranges:
        return None

    return IPAllowlistMiddleware
