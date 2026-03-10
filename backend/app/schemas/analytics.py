"""Pydantic schemas for analytics and dashboard data."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# ============== Category Breakdown ==============


class CategorySpending(BaseModel):
    """Spending for a single category."""

    category_id: UUID | None
    category_name: str
    category_icon: str | None = None
    category_color: str | None = None
    total_amount: Decimal
    transaction_count: int
    percentage: float = Field(description="Percentage of total spending")


class CategoryBreakdownResponse(BaseModel):
    """Category breakdown for a period."""

    period_start: date
    period_end: date
    wallet_id: UUID | None = None
    categories: list[CategorySpending]
    total_spending: Decimal
    currency: str = "AED"


# ============== Time Series ==============


class DailySpending(BaseModel):
    """Spending for a single day."""

    date: date
    debit_amount: Decimal = Field(default=Decimal("0"), description="Total debits (spending)")
    credit_amount: Decimal = Field(default=Decimal("0"), description="Total credits (income)")
    net_amount: Decimal = Field(default=Decimal("0"), description="Net change (credits - debits)")
    transaction_count: int = 0


class SpendingTimeSeriesResponse(BaseModel):
    """Time series of daily spending."""

    period_start: date
    period_end: date
    wallet_id: UUID | None = None
    daily_data: list[DailySpending]
    total_debit: Decimal
    total_credit: Decimal
    average_daily_spending: Decimal
    currency: str = "AED"


# ============== Top Vendors ==============


class VendorStats(BaseModel):
    """Statistics for a single vendor."""

    vendor_id: UUID
    vendor_name: str
    category_id: UUID | None = None
    category_name: str | None = None
    total_amount: Decimal
    transaction_count: int
    last_transaction_date: datetime | None = None


class TopVendorsResponse(BaseModel):
    """Top vendors by spending."""

    period_start: date
    period_end: date
    wallet_id: UUID | None = None
    vendors: list[VendorStats]
    currency: str = "AED"


# ============== Dashboard Summary ==============


class MonthlyComparison(BaseModel):
    """Comparison between current and previous month."""

    current_month_spending: Decimal
    previous_month_spending: Decimal
    change_amount: Decimal
    change_percentage: float | None = Field(
        None, description="Percentage change from previous month"
    )


class DashboardAnalyticsResponse(BaseModel):
    """Complete dashboard analytics."""

    # Period
    period_start: date
    period_end: date
    wallet_id: UUID | None = None

    # Summary totals
    total_balance: Decimal | None = None
    total_spending: Decimal
    total_income: Decimal
    net_change: Decimal

    # Category breakdown (top 5 for quick view)
    top_categories: list[CategorySpending]

    # Top vendors (top 5)
    top_vendors: list[VendorStats]

    # Monthly comparison
    monthly_comparison: MonthlyComparison | None = None

    # Transaction counts
    transaction_count: int
    pending_review_count: int = 0

    currency: str = "AED"


# ============== Export ==============


class ExportRequest(BaseModel):
    """Request for CSV export."""

    wallet_id: UUID | None = None
    category_id: UUID | None = None
    vendor_id: UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    direction: str | None = Field(None, description="Filter by 'debit' or 'credit'")

    model_config = {
        "json_schema_extra": {
            "example": {
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
            }
        }
    }
