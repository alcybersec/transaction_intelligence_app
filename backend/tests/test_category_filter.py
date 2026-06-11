"""Tests for multi-category include/exclude filtering."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal


def _category(db, name="Cat"):
    from app.db.models import Category

    c = Category(
        id=uuid.uuid4(),
        name=f"{name}-{uuid.uuid4().hex[:6]}",
        icon="tag",
        color="#10b981",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _txn(db, category=None, amount="10.00"):
    from app.db.models import TransactionDirection, TransactionGroup, TransactionStatus

    t = TransactionGroup(
        id=uuid.uuid4(),
        direction=TransactionDirection.DEBIT,
        amount=Decimal(amount),
        currency="AED",
        occurred_at=datetime.now(UTC),
        observed_at_min=datetime.now(UTC),
        observed_at_max=datetime.now(UTC),
        category_id=category.id if category else None,
        status=TransactionStatus.POSTED,
    )
    db.add(t)
    db.commit()
    return t


def test_single_category_include(client, auth_headers, db_session):
    a, b = _category(db_session, "A"), _category(db_session, "B")
    _txn(db_session, a)
    _txn(db_session, b)
    r = client.get(f"/transactions?category_id={a.id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_multiple_category_includes_or(client, auth_headers, db_session):
    a, b, c = _category(db_session, "A"), _category(db_session, "B"), _category(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    r = client.get(
        f"/transactions?category_id={a.id}&category_id={b.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_category_exclude(client, auth_headers, db_session):
    a, b, c = _category(db_session, "A"), _category(db_session, "B"), _category(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    r = client.get(f"/transactions?category_id_not={c.id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_multiple_category_excludes(client, auth_headers, db_session):
    a, b, c = _category(db_session, "A"), _category(db_session, "B"), _category(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    r = client.get(
        f"/transactions?category_id_not={a.id}&category_id_not={b.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_excludes_do_not_drop_null_category(client, auth_headers, db_session):
    a = _category(db_session, "A")
    _txn(db_session, a)
    _txn(db_session, None)  # one with cat A, one uncategorized
    r = client.get(f"/transactions?category_id_not={a.id}", headers=auth_headers)
    assert r.status_code == 200
    # Excluding cat A should keep the uncategorized txn
    assert r.json()["total"] == 1


def test_includes_and_excludes_combined(client, auth_headers, db_session):
    a, b, c = _category(db_session, "A"), _category(db_session, "B"), _category(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    # Include A or B, exclude B → leaves only A
    r = client.get(
        f"/transactions?category_id={a.id}&category_id={b.id}&category_id_not={b.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_summary_respects_category_excludes(client, auth_headers, db_session):
    a, b = _category(db_session, "A"), _category(db_session, "B")
    _txn(db_session, a, "50.00")
    _txn(db_session, b, "30.00")
    r = client.get(f"/transactions/summary?category_id_not={a.id}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_debit"] == "30.00"
    assert body["debit_count"] == 1
