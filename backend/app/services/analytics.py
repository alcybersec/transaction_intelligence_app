"""Analytics service for spending aggregations and dashboard data."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    Category,
    Message,
    ParseStatus,
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
    Vendor,
    Wallet,
)
from app.schemas.analytics import (
    CategoryBreakdownResponse,
    CategorySpending,
    DailySpending,
    DashboardAnalyticsResponse,
    MonthlyComparison,
    SpendingTimeSeriesResponse,
    TopVendorsResponse,
    VendorStats,
)


class AnalyticsService:
    """Service for analytics and dashboard data."""

    def __init__(self, db: Session):
        self.db = db

    def get_category_breakdown(
        self,
        period_start: date,
        period_end: date,
        wallet_id: UUID | None = None,
        direction: TransactionDirection = TransactionDirection.DEBIT,
    ) -> CategoryBreakdownResponse:
        """
        Get spending breakdown by category for a period.

        Args:
            period_start: Start date of period
            period_end: End date of period
            wallet_id: Optional wallet filter
            direction: Transaction direction (debit for spending, credit for income)

        Returns:
            Category breakdown with totals and percentages
        """
        # Convert dates to datetime for query
        start_dt = datetime.combine(period_start, datetime.min.time())
        end_dt = datetime.combine(period_end, datetime.max.time())

        # Base query
        query = (
            self.db.query(
                TransactionGroup.category_id,
                Category.name.label("category_name"),
                Category.icon.label("category_icon"),
                Category.color.label("category_color"),
                func.sum(TransactionGroup.amount).label("total_amount"),
                func.count(TransactionGroup.id).label("transaction_count"),
            )
            .outerjoin(Category, TransactionGroup.category_id == Category.id)
            .filter(
                TransactionGroup.occurred_at >= start_dt,
                TransactionGroup.occurred_at <= end_dt,
                TransactionGroup.direction == direction,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
        )

        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        # Group by category
        results = query.group_by(
            TransactionGroup.category_id,
            Category.name,
            Category.icon,
            Category.color,
        ).all()

        # Calculate total for percentages
        total = sum(r.total_amount or Decimal("0") for r in results)

        # Build category spending list
        categories = []
        for r in results:
            amount = r.total_amount or Decimal("0")
            percentage = float(amount / total * 100) if total > 0 else 0.0
            categories.append(
                CategorySpending(
                    category_id=r.category_id,
                    category_name=r.category_name or "Uncategorized",
                    category_icon=r.category_icon,
                    category_color=r.category_color,
                    total_amount=amount,
                    transaction_count=r.transaction_count,
                    percentage=round(percentage, 1),
                )
            )

        # Sort by amount descending
        categories.sort(key=lambda x: x.total_amount, reverse=True)

        return CategoryBreakdownResponse(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
            categories=categories,
            total_spending=total,
            currency="AED",
        )

    def get_spending_time_series(
        self,
        period_start: date,
        period_end: date,
        wallet_id: UUID | None = None,
    ) -> SpendingTimeSeriesResponse:
        """
        Get daily spending time series for a period.

        Args:
            period_start: Start date
            period_end: End date
            wallet_id: Optional wallet filter

        Returns:
            Time series with daily debit/credit/net amounts
        """
        start_dt = datetime.combine(period_start, datetime.min.time())
        end_dt = datetime.combine(period_end, datetime.max.time())

        # Query daily aggregates
        query = self.db.query(
            func.date(TransactionGroup.occurred_at).label("date"),
            TransactionGroup.direction,
            func.sum(TransactionGroup.amount).label("total"),
            func.count(TransactionGroup.id).label("count"),
        ).filter(
            TransactionGroup.occurred_at >= start_dt,
            TransactionGroup.occurred_at <= end_dt,
            TransactionGroup.status == TransactionStatus.POSTED,
        )

        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        results = query.group_by(
            func.date(TransactionGroup.occurred_at),
            TransactionGroup.direction,
        ).all()

        # Build a map of date -> {debit, credit, count}
        daily_map: dict[date, dict] = {}

        # Initialize all days in range
        current = period_start
        while current <= period_end:
            daily_map[current] = {
                "debit": Decimal("0"),
                "credit": Decimal("0"),
                "count": 0,
            }
            current += timedelta(days=1)

        # Populate from results
        for r in results:
            d = r.date
            if d in daily_map:
                if r.direction == TransactionDirection.DEBIT:
                    daily_map[d]["debit"] = r.total or Decimal("0")
                else:
                    daily_map[d]["credit"] = r.total or Decimal("0")
                daily_map[d]["count"] += r.count

        # Build response list
        daily_data = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")

        for d in sorted(daily_map.keys()):
            data = daily_map[d]
            debit = data["debit"]
            credit = data["credit"]
            total_debit += debit
            total_credit += credit

            daily_data.append(
                DailySpending(
                    date=d,
                    debit_amount=debit,
                    credit_amount=credit,
                    net_amount=credit - debit,
                    transaction_count=data["count"],
                )
            )

        # Calculate average daily spending
        num_days = (period_end - period_start).days + 1
        avg_daily = total_debit / num_days if num_days > 0 else Decimal("0")

        return SpendingTimeSeriesResponse(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
            daily_data=daily_data,
            total_debit=total_debit,
            total_credit=total_credit,
            average_daily_spending=avg_daily.quantize(Decimal("0.01")),
            currency="AED",
        )

    def get_top_vendors(
        self,
        period_start: date,
        period_end: date,
        wallet_id: UUID | None = None,
        limit: int = 10,
        direction: TransactionDirection = TransactionDirection.DEBIT,
    ) -> TopVendorsResponse:
        """
        Get top vendors by spending for a period.

        Args:
            period_start: Start date
            period_end: End date
            wallet_id: Optional wallet filter
            limit: Max number of vendors to return
            direction: Transaction direction

        Returns:
            Top vendors with spending stats
        """
        start_dt = datetime.combine(period_start, datetime.min.time())
        end_dt = datetime.combine(period_end, datetime.max.time())

        query = (
            self.db.query(
                TransactionGroup.vendor_id,
                Vendor.canonical_name.label("vendor_name"),
                TransactionGroup.category_id,
                Category.name.label("category_name"),
                func.sum(TransactionGroup.amount).label("total_amount"),
                func.count(TransactionGroup.id).label("transaction_count"),
                func.max(TransactionGroup.occurred_at).label("last_transaction"),
            )
            .join(Vendor, TransactionGroup.vendor_id == Vendor.id)
            .outerjoin(Category, TransactionGroup.category_id == Category.id)
            .filter(
                TransactionGroup.occurred_at >= start_dt,
                TransactionGroup.occurred_at <= end_dt,
                TransactionGroup.direction == direction,
                TransactionGroup.status == TransactionStatus.POSTED,
                TransactionGroup.vendor_id.isnot(None),
            )
        )

        if wallet_id:
            query = query.filter(TransactionGroup.wallet_id == wallet_id)

        results = (
            query.group_by(
                TransactionGroup.vendor_id,
                Vendor.canonical_name,
                TransactionGroup.category_id,
                Category.name,
            )
            .order_by(func.sum(TransactionGroup.amount).desc())
            .limit(limit)
            .all()
        )

        vendors = [
            VendorStats(
                vendor_id=r.vendor_id,
                vendor_name=r.vendor_name,
                category_id=r.category_id,
                category_name=r.category_name,
                total_amount=r.total_amount,
                transaction_count=r.transaction_count,
                last_transaction_date=r.last_transaction,
            )
            for r in results
        ]

        return TopVendorsResponse(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
            vendors=vendors,
            currency="AED",
        )

    def get_monthly_comparison(
        self,
        wallet_id: UUID | None = None,
    ) -> MonthlyComparison:
        """
        Compare current month spending to previous month.

        Args:
            wallet_id: Optional wallet filter

        Returns:
            Monthly comparison with change amount and percentage
        """
        now = datetime.utcnow()

        # Current month bounds
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        current_month_end = now

        # Previous month bounds
        prev_month_end = current_month_start - timedelta(days=1)
        prev_month_start = prev_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        def get_spending(start: datetime, end: datetime) -> Decimal:
            query = self.db.query(func.sum(TransactionGroup.amount)).filter(
                TransactionGroup.occurred_at >= start,
                TransactionGroup.occurred_at <= end,
                TransactionGroup.direction == TransactionDirection.DEBIT,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            if wallet_id:
                query = query.filter(TransactionGroup.wallet_id == wallet_id)
            return query.scalar() or Decimal("0")

        current = get_spending(current_month_start, current_month_end)
        previous = get_spending(prev_month_start, prev_month_end)

        change = current - previous
        change_pct = None
        if previous > 0:
            change_pct = float((change / previous) * 100)

        return MonthlyComparison(
            current_month_spending=current,
            previous_month_spending=previous,
            change_amount=change,
            change_percentage=round(change_pct, 1) if change_pct is not None else None,
        )

    def get_dashboard_analytics(
        self,
        wallet_id: UUID | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
    ) -> DashboardAnalyticsResponse:
        """
        Get complete dashboard analytics.

        Args:
            wallet_id: Optional wallet filter
            period_start: Start date (defaults to start of current month)
            period_end: End date (defaults to today)

        Returns:
            Complete dashboard analytics response
        """
        now = datetime.utcnow()

        # Default to current month
        if period_start is None:
            period_start = now.replace(day=1).date()
        if period_end is None:
            period_end = now.date()

        start_dt = datetime.combine(period_start, datetime.min.time())
        end_dt = datetime.combine(period_end, datetime.max.time())

        # Get total balance
        total_balance = None
        if wallet_id:
            wallet = self.db.query(Wallet).filter(Wallet.id == wallet_id).first()
            if wallet:
                total_balance = wallet.combined_balance_last
        else:
            balance_sum = (
                self.db.query(func.sum(Wallet.combined_balance_last))
                .filter(Wallet.combined_balance_last.isnot(None))
                .scalar()
            )
            total_balance = balance_sum

        # Get spending and income totals
        def get_totals(direction: TransactionDirection) -> tuple[Decimal, int]:
            query = self.db.query(
                func.sum(TransactionGroup.amount),
                func.count(TransactionGroup.id),
            ).filter(
                TransactionGroup.occurred_at >= start_dt,
                TransactionGroup.occurred_at <= end_dt,
                TransactionGroup.direction == direction,
                TransactionGroup.status == TransactionStatus.POSTED,
            )
            if wallet_id:
                query = query.filter(TransactionGroup.wallet_id == wallet_id)
            result = query.first()
            return (result[0] or Decimal("0"), result[1] or 0)

        spending, spending_count = get_totals(TransactionDirection.DEBIT)
        income, income_count = get_totals(TransactionDirection.CREDIT)

        # Get category breakdown (top 5)
        category_breakdown = self.get_category_breakdown(period_start, period_end, wallet_id)
        top_categories = category_breakdown.categories[:5]

        # Get top vendors (top 5)
        top_vendors_resp = self.get_top_vendors(period_start, period_end, wallet_id, limit=5)
        top_vendors = top_vendors_resp.vendors

        # Get monthly comparison
        monthly_comparison = self.get_monthly_comparison(wallet_id)

        # Get pending review count
        pending_review = (
            self.db.query(func.count(Message.id))
            .filter(Message.parse_status == ParseStatus.NEEDS_REVIEW)
            .scalar()
            or 0
        )

        return DashboardAnalyticsResponse(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
            total_balance=total_balance,
            total_spending=spending,
            total_income=income,
            net_change=income - spending,
            top_categories=top_categories,
            top_vendors=top_vendors,
            monthly_comparison=monthly_comparison,
            transaction_count=spending_count + income_count,
            pending_review_count=pending_review,
            currency="AED",
        )
