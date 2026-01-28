"""API routes aggregation."""

from fastapi import APIRouter

from app.api.routes.ai import router as ai_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.budgets import router as budgets_router
from app.api.routes.categories import router as categories_router
from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router
from app.api.routes.reports import router as reports_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.vendors import router as vendors_router
from app.api.routes.wallets import router as wallets_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(health_router, tags=["health"])
router.include_router(ingest_router, prefix="/ingest", tags=["ingestion"])
router.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
router.include_router(wallets_router, prefix="/wallets", tags=["wallets"])
router.include_router(categories_router, prefix="/categories", tags=["categories"])
router.include_router(vendors_router, prefix="/vendors", tags=["vendors"])
router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
router.include_router(budgets_router, prefix="/budgets", tags=["budgets"])
router.include_router(reports_router, prefix="/reports", tags=["reports"])
router.include_router(ai_router, prefix="/ai", tags=["ai"])
