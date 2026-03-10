"""Export service for CSV transaction exports."""

import csv
import io
from datetime import date, datetime
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
)
from app.schemas.analytics import ExportRequest


class ExportService:
    """Service for exporting transaction data."""

    def __init__(self, db: Session):
        self.db = db

    def export_transactions_csv(
        self,
        request: ExportRequest,
    ) -> str:
        """
        Export transactions to CSV format.

        Args:
            request: Export filter request

        Returns:
            CSV content as string
        """
        # Build query
        query = (
            self.db.query(TransactionGroup)
            .options(
                joinedload(TransactionGroup.wallet),
                joinedload(TransactionGroup.vendor),
                joinedload(TransactionGroup.category),
            )
            .filter(TransactionGroup.status == TransactionStatus.POSTED)
        )

        # Apply filters
        if request.wallet_id:
            query = query.filter(TransactionGroup.wallet_id == request.wallet_id)

        if request.category_id:
            query = query.filter(TransactionGroup.category_id == request.category_id)

        if request.vendor_id:
            query = query.filter(TransactionGroup.vendor_id == request.vendor_id)

        if request.start_date:
            start_dt = datetime.combine(request.start_date, datetime.min.time())
            query = query.filter(TransactionGroup.occurred_at >= start_dt)

        if request.end_date:
            end_dt = datetime.combine(request.end_date, datetime.max.time())
            query = query.filter(TransactionGroup.occurred_at <= end_dt)

        if request.direction:
            direction = TransactionDirection(request.direction)
            query = query.filter(TransactionGroup.direction == direction)

        # Order by date
        transactions = query.order_by(TransactionGroup.occurred_at.desc()).all()

        # Generate CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Header row
        writer.writerow(
            [
                "Date",
                "Time",
                "Type",
                "Amount",
                "Currency",
                "Vendor",
                "Category",
                "Wallet",
                "Balance After",
                "Reference",
                "Notes",
                "Status",
            ]
        )

        # Data rows
        for txn in transactions:
            writer.writerow(
                [
                    txn.occurred_at.strftime("%Y-%m-%d"),
                    txn.occurred_at.strftime("%H:%M:%S"),
                    txn.direction.value.capitalize(),
                    f"{txn.amount:.2f}",
                    txn.currency,
                    txn.vendor.canonical_name if txn.vendor else txn.vendor_raw or "",
                    txn.category.name if txn.category else "Uncategorized",
                    txn.wallet.name if txn.wallet else "",
                    f"{txn.combined_balance_after:.2f}" if txn.combined_balance_after else "",
                    txn.reference_id or "",
                    txn.notes or "",
                    txn.status.value,
                ]
            )

        return output.getvalue()

    def export_category_summary_csv(
        self,
        period_start: date,
        period_end: date,
        wallet_id: UUID | None = None,
    ) -> str:
        """
        Export category spending summary to CSV.

        Args:
            period_start: Start date
            period_end: End date
            wallet_id: Optional wallet filter

        Returns:
            CSV content as string
        """
        from app.services.analytics import AnalyticsService

        analytics = AnalyticsService(self.db)
        breakdown = analytics.get_category_breakdown(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
        )

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            [
                "Category",
                "Amount",
                "Currency",
                "Transactions",
                "Percentage",
            ]
        )

        # Data rows
        for cat in breakdown.categories:
            writer.writerow(
                [
                    cat.category_name,
                    f"{cat.total_amount:.2f}",
                    breakdown.currency,
                    cat.transaction_count,
                    f"{cat.percentage:.1f}%",
                ]
            )

        # Total row
        writer.writerow(
            [
                "TOTAL",
                f"{breakdown.total_spending:.2f}",
                breakdown.currency,
                sum(c.transaction_count for c in breakdown.categories),
                "100.0%",
            ]
        )

        return output.getvalue()

    def export_vendor_summary_csv(
        self,
        period_start: date,
        period_end: date,
        wallet_id: UUID | None = None,
        limit: int = 50,
    ) -> str:
        """
        Export vendor spending summary to CSV.

        Args:
            period_start: Start date
            period_end: End date
            wallet_id: Optional wallet filter
            limit: Max number of vendors

        Returns:
            CSV content as string
        """
        from app.services.analytics import AnalyticsService

        analytics = AnalyticsService(self.db)
        top_vendors = analytics.get_top_vendors(
            period_start=period_start,
            period_end=period_end,
            wallet_id=wallet_id,
            limit=limit,
        )

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            [
                "Vendor",
                "Category",
                "Amount",
                "Currency",
                "Transactions",
                "Last Transaction",
            ]
        )

        # Data rows
        for vendor in top_vendors.vendors:
            writer.writerow(
                [
                    vendor.vendor_name,
                    vendor.category_name or "Uncategorized",
                    f"{vendor.total_amount:.2f}",
                    top_vendors.currency,
                    vendor.transaction_count,
                    vendor.last_transaction_date.strftime("%Y-%m-%d")
                    if vendor.last_transaction_date
                    else "",
                ]
            )

        return output.getvalue()
