"""Heuristic-based smart insights over analytics."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.db.models.transaction import TransactionDirection, TransactionGroup


def _count_recurring(db: Session, period_start: date, period_end: date) -> int:
    """Count rows flagged is_recurring in period.

    The is_recurring column is added by slot 1a; gracefully return 0 if it
    is not present yet.
    """
    try:
        return (
            db.query(TransactionGroup)
            .filter(TransactionGroup.is_recurring.is_(True))
            .filter(TransactionGroup.occurred_at >= period_start)
            .filter(TransactionGroup.occurred_at <= period_end)
            .count()
        )
    except (AttributeError, OperationalError, ProgrammingError):
        return 0


def _sum_debits(db: Session, start: date, end: date) -> Decimal:
    rows = (
        db.query(TransactionGroup)
        .filter(TransactionGroup.direction == TransactionDirection.DEBIT)
        .filter(TransactionGroup.occurred_at >= start)
        .filter(TransactionGroup.occurred_at <= end)
        .all()
    )
    return sum((r.amount for r in rows), Decimal("0"))


def compute_insights(db: Session, period_start: date, period_end: date) -> dict:
    """Compute insights for a period.

    Returns a dict matching InsightsResponse:
      - subscriptions_count: count of is_recurring=True groups in period.
      - spending_trend: "up"|"down"|"flat"|None comparing current debit total
        vs prior equal-length window. None when no prior data.
      - spending_change_percentage: percent change from prior window (0.0 if
        no prior data).
      - top_merchant_alt, budget_forecast: None placeholders for v2.0.
    """
    sub_count = _count_recurring(db, period_start, period_end)

    # Prior equal-length window directly preceding the current one.
    span_days = (period_end - period_start).days or 30
    prev_start = period_start - timedelta(days=span_days + 1)
    prev_end = period_start - timedelta(days=1)

    current = _sum_debits(db, period_start, period_end)
    prev = _sum_debits(db, prev_start, prev_end)
    if prev == 0:
        trend: str | None = None
        pct = 0.0
    else:
        change = float((current - prev) / prev * 100)
        pct = round(change, 1)
        if abs(change) < 2:
            trend = "flat"
        elif change > 0:
            trend = "up"
        else:
            trend = "down"

    return {
        "subscriptions_count": sub_count,
        "top_merchant_alt": None,  # heuristic placeholder; future expansion
        "budget_forecast": None,  # heuristic placeholder
        "spending_trend": trend,
        "spending_change_percentage": pct,
    }
