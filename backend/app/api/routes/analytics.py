"""Analytics API endpoints."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.analytics import (
    CategoryBreakdownResponse,
    DashboardAnalyticsResponse,
    SpendingTimeSeriesResponse,
    TopVendorsResponse,
)
from app.services.analytics import AnalyticsService

router = APIRouter()


@router.get("/dashboard", response_model=DashboardAnalyticsResponse)
async def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
    period_start: date | None = Query(None, description="Start date (defaults to start of month)"),
    period_end: date | None = Query(None, description="End date (defaults to today)"),
) -> DashboardAnalyticsResponse:
    """
    Get complete dashboard analytics.

    Returns summary totals, category breakdown, top vendors, and monthly comparison.
    """
    from uuid import UUID

    service = AnalyticsService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    return service.get_dashboard_analytics(
        wallet_id=wallet_uuid,
        period_start=period_start,
        period_end=period_end,
    )


@router.get("/categories", response_model=CategoryBreakdownResponse)
async def get_category_breakdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_start: date = Query(..., description="Start date"),
    period_end: date = Query(..., description="End date"),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
    direction: str = Query("debit", description="Transaction direction: 'debit' or 'credit'"),
) -> CategoryBreakdownResponse:
    """
    Get spending breakdown by category for a period.
    """
    from uuid import UUID

    from app.db.models import TransactionDirection

    service = AnalyticsService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None
    txn_direction = TransactionDirection(direction)

    return service.get_category_breakdown(
        period_start=period_start,
        period_end=period_end,
        wallet_id=wallet_uuid,
        direction=txn_direction,
    )


@router.get("/timeseries", response_model=SpendingTimeSeriesResponse)
async def get_spending_time_series(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_start: date = Query(..., description="Start date"),
    period_end: date = Query(..., description="End date"),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
) -> SpendingTimeSeriesResponse:
    """
    Get daily spending time series for a period.

    Returns debit/credit amounts per day with totals and averages.
    """
    from uuid import UUID

    service = AnalyticsService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None

    return service.get_spending_time_series(
        period_start=period_start,
        period_end=period_end,
        wallet_id=wallet_uuid,
    )


@router.get("/top-vendors", response_model=TopVendorsResponse)
async def get_top_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period_start: date = Query(..., description="Start date"),
    period_end: date = Query(..., description="End date"),
    wallet_id: str | None = Query(None, description="Filter by wallet UUID"),
    limit: int = Query(10, ge=1, le=50, description="Max vendors to return"),
    direction: str = Query("debit", description="Transaction direction: 'debit' or 'credit'"),
) -> TopVendorsResponse:
    """
    Get top vendors by spending for a period.
    """
    from uuid import UUID

    from app.db.models import TransactionDirection

    service = AnalyticsService(db)
    wallet_uuid = UUID(wallet_id) if wallet_id else None
    txn_direction = TransactionDirection(direction)

    return service.get_top_vendors(
        period_start=period_start,
        period_end=period_end,
        wallet_id=wallet_uuid,
        limit=limit,
        direction=txn_direction,
    )
