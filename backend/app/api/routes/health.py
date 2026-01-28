"""Health check endpoints with dependency status and Prometheus metrics."""

import redis
from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.core import metrics as prom_metrics

router = APIRouter()

# Legacy in-memory counters (kept for backward compatibility)
# New code should use Prometheus metrics from app.core.metrics
_metrics = {
    "messages_ingested": 0,
    "messages_deduped": 0,
    "parse_failed": 0,
}


def get_metrics() -> dict:
    """Get current metrics (legacy in-memory counters)."""
    return _metrics.copy()


def increment_metric(name: str, value: int = 1) -> None:
    """Increment a metric counter (legacy)."""
    if name in _metrics:
        _metrics[name] += value


@router.get("/health")
async def health_check(db: Session = Depends(get_db)) -> dict:
    """
    Comprehensive health check endpoint.

    Checks:
    - Database connectivity
    - Redis connectivity
    - Returns basic metrics
    """
    status = "healthy"
    checks = {}

    # Check PostgreSQL
    try:
        db.execute(text("SELECT 1"))
        checks["postgres"] = {"status": "healthy"}
    except Exception as e:
        status = "unhealthy"
        checks["postgres"] = {"status": "unhealthy", "error": str(e)}

    # Check Redis
    try:
        r = redis.from_url(settings.redis_url)
        r.ping()
        checks["redis"] = {"status": "healthy"}
    except Exception as e:
        status = "unhealthy"
        checks["redis"] = {"status": "unhealthy", "error": str(e)}

    # Get IMAP status from Redis (set by worker)
    try:
        r = redis.from_url(settings.redis_url)
        last_imap_heartbeat = r.get("imap:last_heartbeat")
        if last_imap_heartbeat:
            checks["imap_worker"] = {
                "status": "healthy",
                "last_heartbeat": last_imap_heartbeat.decode("utf-8"),
            }
        else:
            checks["imap_worker"] = {
                "status": "unknown",
                "message": "No heartbeat recorded yet",
            }
    except Exception:
        checks["imap_worker"] = {"status": "unknown"}

    return {
        "status": status,
        "service": "api",
        "version": "0.1.0",
        "checks": checks,
        "metrics": get_metrics(),
    }


@router.get("/health/simple")
async def simple_health() -> dict:
    """Simple health check (no dependency checks)."""
    return {
        "status": "healthy",
        "service": "api",
        "version": "0.1.0",
    }


@router.get("/metrics")
async def prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint.

    Returns metrics in Prometheus text format for scraping.
    Configure Prometheus to scrape this endpoint at /metrics.
    """
    return Response(
        content=prom_metrics.get_metrics(),
        media_type=prom_metrics.get_content_type(),
    )
