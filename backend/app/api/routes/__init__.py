"""API routes aggregation."""

from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router

router = APIRouter()

router.include_router(health_router, tags=["health"])
router.include_router(ingest_router, prefix="/ingest", tags=["ingestion"])
