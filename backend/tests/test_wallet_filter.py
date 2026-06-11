"""Tests for multi-wallet include/exclude filtering."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal


def _wallet(db, name="Wallet"):
    from app.db.models import Wallet

    w = Wallet(
        id=uuid.uuid4(),
        name=f"{name}-{uuid.uuid4().hex[:6]}",
        currency="AED",
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


def _txn(db, wallet=None, amount="10.00"):
    from app.db.models import TransactionDirection, TransactionGroup, TransactionStatus

    t = TransactionGroup(
        id=uuid.uuid4(),
        wallet_id=wallet.id if wallet else None,
        direction=TransactionDirection.DEBIT,
        amount=Decimal(amount),
        currency="AED",
        occurred_at=datetime.now(UTC),
        observed_at_min=datetime.now(UTC),
        observed_at_max=datetime.now(UTC),
        status=TransactionStatus.POSTED,
    )
    db.add(t)
    db.commit()
    return t


def test_single_wallet_include(client, auth_headers, db_session):
    a, b = _wallet(db_session, "A"), _wallet(db_session, "B")
    _txn(db_session, a)
    _txn(db_session, b)
    r = client.get(f"/transactions?wallet_id={a.id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_multiple_wallet_includes_or(client, auth_headers, db_session):
    a, b, c = _wallet(db_session, "A"), _wallet(db_session, "B"), _wallet(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    r = client.get(
        f"/transactions?wallet_id={a.id}&wallet_id={b.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_wallet_exclude(client, auth_headers, db_session):
    a, b, c = _wallet(db_session, "A"), _wallet(db_session, "B"), _wallet(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    r = client.get(f"/transactions?wallet_id_not={c.id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_multiple_wallet_excludes(client, auth_headers, db_session):
    a, b, c = _wallet(db_session, "A"), _wallet(db_session, "B"), _wallet(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    r = client.get(
        f"/transactions?wallet_id_not={a.id}&wallet_id_not={b.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_excludes_do_not_drop_null_wallet(client, auth_headers, db_session):
    a = _wallet(db_session, "A")
    _txn(db_session, a)
    _txn(db_session, None)  # one with wallet A, one with no wallet
    r = client.get(f"/transactions?wallet_id_not={a.id}", headers=auth_headers)
    assert r.status_code == 200
    # Excluding wallet A should keep the no-wallet txn
    assert r.json()["total"] == 1


def test_wallet_includes_and_excludes_combined(client, auth_headers, db_session):
    a, b, c = _wallet(db_session, "A"), _wallet(db_session, "B"), _wallet(db_session, "C")
    _txn(db_session, a)
    _txn(db_session, b)
    _txn(db_session, c)
    # Include A or B, exclude B → leaves only A
    r = client.get(
        f"/transactions?wallet_id={a.id}&wallet_id={b.id}&wallet_id_not={b.id}",
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_summary_respects_wallet_excludes(client, auth_headers, db_session):
    a, b = _wallet(db_session, "A"), _wallet(db_session, "B")
    _txn(db_session, a, "50.00")
    _txn(db_session, b, "30.00")
    r = client.get(f"/transactions/summary?wallet_id_not={a.id}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_debit"] == "30.00"
    assert body["debit_count"] == 1
