"""TDD: is_recurring on transactions — single + bulk toggle, list filter, dashboard count."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from app.db.models.transaction import (
    TransactionDirection,
    TransactionGroup,
    TransactionStatus,
)


def _make_txn(
    db_session,
    user_id,
    *,
    recurring=False,
    amount="10.00",
    direction=TransactionDirection.DEBIT,
    occurred_at=None,
):
    now = occurred_at or datetime.now(UTC)
    t = TransactionGroup(
        id=uuid.uuid4(),
        direction=direction,
        amount=Decimal(amount),
        currency="AED",
        occurred_at=now,
        observed_at_min=now,
        observed_at_max=now,
        status=TransactionStatus.POSTED,
        is_recurring=recurring,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


def test_default_is_recurring_is_false(db_session, test_user):
    t = _make_txn(db_session, test_user.id)
    assert t.is_recurring is False


def test_patch_sets_is_recurring(client, auth_headers, db_session, test_user):
    t = _make_txn(db_session, test_user.id)
    r = client.patch(
        f"/transactions/{t.id}",
        headers=auth_headers,
        json={"is_recurring": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_recurring"] is True


def test_bulk_patch_recurring(client, auth_headers, db_session, test_user):
    ids = [str(_make_txn(db_session, test_user.id).id) for _ in range(3)]
    r = client.patch(
        "/transactions/bulk",
        headers=auth_headers,
        json={"ids": ids, "is_recurring": True},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"updated": 3}


def test_list_filter_recurring_true(client, auth_headers, db_session, test_user):
    _make_txn(db_session, test_user.id, recurring=True)
    _make_txn(db_session, test_user.id, recurring=False)
    r = client.get("/transactions?recurring=true", headers=auth_headers)
    assert r.status_code == 200, r.text
    rows = r.json()["transactions"]
    assert len(rows) == 1
    assert rows[0]["is_recurring"] is True


def test_list_filter_recurring_false(client, auth_headers, db_session, test_user):
    _make_txn(db_session, test_user.id, recurring=True)
    _make_txn(db_session, test_user.id, recurring=False)
    r = client.get("/transactions?recurring=false", headers=auth_headers)
    assert r.status_code == 200, r.text
    rows = r.json()["transactions"]
    assert len(rows) == 1
    assert rows[0]["is_recurring"] is False


def test_dashboard_returns_subscriptions_count(client, auth_headers, db_session, test_user):
    occurred = datetime(2026, 6, 15, 12, 0, 0, tzinfo=UTC)
    _make_txn(db_session, test_user.id, recurring=True, occurred_at=occurred)
    _make_txn(db_session, test_user.id, recurring=True, occurred_at=occurred)
    _make_txn(db_session, test_user.id, recurring=False, occurred_at=occurred)
    r = client.get(
        "/analytics/dashboard?period_start=2026-06-01&period_end=2026-06-30",
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["subscriptions_count"] == 2
