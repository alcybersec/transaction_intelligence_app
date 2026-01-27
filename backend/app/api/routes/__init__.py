"""API routes aggregation."""

from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.wallets import router as wallets_router

router = APIRouter()

router.include_router(health_router, tags=["health"])
router.include_router(ingest_router, prefix="/ingest", tags=["ingestion"])
router.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
router.include_router(wallets_router, prefix="/wallets", tags=["wallets"])
