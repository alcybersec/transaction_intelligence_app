"""TDD: GET /transactions/summary aggregates filter-aware totals."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from app.db.models.transaction import (
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
)


def _mk(db, *, direction, amount, currency="AED"):
    now = datetime.now(UTC)
    t = TransactionGroup(
        id=uuid.uuid4(),
        direction=direction,
        amount=Decimal(amount),
        currency=currency,
        occurred_at=now,
        observed_at_min=now,
        observed_at_max=now,
        status=TransactionStatus.POSTED,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def test_summary_empty_returns_zeros(client, auth_headers):
    r = client.get("/transactions/summary", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {
        "total_debit": "0.00",
        "total_credit": "0.00",
        "net": "0.00",
        "debit_count": 0,
        "credit_count": 0,
        "avg_debit": "0.00",
    }


def test_summary_basic_totals(client, auth_headers, db_session):
    _mk(db_session, direction=TransactionDirection.DEBIT, amount="10.00")
    _mk(db_session, direction=TransactionDirection.DEBIT, amount="20.00")
    _mk(db_session, direction=TransactionDirection.CREDIT, amount="50.00")
    r = client.get("/transactions/summary", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_debit"] == "30.00"
    assert body["total_credit"] == "50.00"
    assert body["net"] == "20.00"
    assert body["debit_count"] == 2
    assert body["credit_count"] == 1
    assert body["avg_debit"] == "15.00"


def test_summary_respects_direction_filter(client, auth_headers, db_session):
    _mk(db_session, direction=TransactionDirection.DEBIT, amount="10.00")
    _mk(db_session, direction=TransactionDirection.CREDIT, amount="50.00")
    r = client.get("/transactions/summary?direction=debit", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_debit"] == "10.00"
    assert body["total_credit"] == "0.00"
    assert body["debit_count"] == 1
    assert body["credit_count"] == 0
