"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import settings
from app.core.logging import get_logger, setup_logging
from app.core.middleware import PrometheusMiddleware

# Initialize structured logging
setup_logging()

logger = get_logger(__name__)

app = FastAPI(
    title="Transaction Intelligence API",
    description="Backend API for Transaction Intelligence App",
    version="0.1.0",
)

# CORS middleware for frontend
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
_extra = [o.strip() for o in (settings.cors_origins or "").split(",") if o.strip()]
_all_origins = _default_origins + _extra

app.add_middleware(
    CORSMiddleware,
    allow_origins=_all_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics middleware
app.add_middleware(PrometheusMiddleware)

# IP Allowlist middleware (optional, for LAN/Tailscale restriction)
if settings.allowed_ip_ranges:
    from app.core.ip_allowlist import IPAllowlistMiddleware

    allowed_ranges = [r.strip() for r in settings.allowed_ip_ranges.split(",") if r.strip()]
    if allowed_ranges:
        app.add_middleware(IPAllowlistMiddleware, allowed_ranges=allowed_ranges)
        logger.info("ip_allowlist_middleware_enabled", ranges=allowed_ranges)

# Include API routes
app.include_router(router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Transaction Intelligence API",
        "docs": "/docs",
        "health": "/health",
    }
