"""FastAPI middleware for metrics and logging."""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.metrics import http_requests_total, http_request_duration_seconds


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to track HTTP request metrics for Prometheus."""

    # Endpoints to exclude from metrics (high cardinality or internal)
    EXCLUDE_PATHS = {"/metrics", "/health/simple", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip metrics for excluded paths
        path = request.url.path
        if path in self.EXCLUDE_PATHS:
            return await call_next(request)

        # Normalize path to reduce cardinality (replace IDs with placeholders)
        normalized_path = self._normalize_path(path)
        method = request.method

        # Track request duration
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            status = str(response.status_code)
        except Exception:
            status = "500"
            raise
        finally:
            duration = time.perf_counter() - start_time

            # Record metrics
            http_requests_total.labels(
                method=method,
                endpoint=normalized_path,
                status=status,
            ).inc()

            http_request_duration_seconds.labels(
                method=method,
                endpoint=normalized_path,
            ).observe(duration)

        return response

    def _normalize_path(self, path: str) -> str:
        """Normalize path to reduce cardinality by replacing IDs with placeholders."""
        parts = path.split("/")
        normalized_parts = []

        for i, part in enumerate(parts):
            if not part:
                normalized_parts.append(part)
                continue

            # Check if this looks like a UUID
            if len(part) == 36 and part.count("-") == 4:
                normalized_parts.append("{id}")
            # Check if this looks like an integer ID
            elif part.isdigit():
                normalized_parts.append("{id}")
            else:
                normalized_parts.append(part)

        return "/".join(normalized_parts)
