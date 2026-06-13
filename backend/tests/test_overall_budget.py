"""Tests for overall (no-category) monthly budgets."""

from __future__ import annotations

import uuid
from datetime import date


def _month_iso(month: date) -> str:
    return month.replace(day=1).isoformat()


def test_create_overall_budget(client, auth_headers):
    r = client.post(
        "/budgets",
        headers=auth_headers,
        json={
            "category_id": None,
            "month": _month_iso(date(2026, 6, 1)),
            "limit_amount": "5000.00",
            "currency": "AED",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category_id"] is None
    assert body["category_name"] is None
    assert body["limit_amount"] == "5000.00"


def test_overall_and_category_budgets_coexist(client, auth_headers, db_session):
    from app.db.models import Category

    cat = Category(id=uuid.uuid4(), name="TestCat", icon="tag", color="#10b981")
    db_session.add(cat)
    db_session.commit()

    month_str = _month_iso(date(2026, 6, 1))
    r1 = client.post(
        "/budgets",
        headers=auth_headers,
        json={
            "category_id": str(cat.id),
            "month": month_str,
            "limit_amount": "1000.00",
        },
    )
    assert r1.status_code == 201, r1.text
    r2 = client.post(
        "/budgets",
        headers=auth_headers,
        json={
            "category_id": None,
            "month": month_str,
            "limit_amount": "3000.00",
        },
    )
    assert r2.status_code == 201, r2.text

    r = client.get(f"/budgets?month={month_str}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "budgets" in body
    cats = [b for b in body["budgets"] if b["category_id"] is not None]
    overall = [b for b in body["budgets"] if b["category_id"] is None]
    assert len(cats) == 1
    assert len(overall) == 1


def test_duplicate_overall_budget_rejected(client, auth_headers):
    month_str = _month_iso(date(2026, 7, 1))
    client.post(
        "/budgets",
        headers=auth_headers,
        json={
            "category_id": None,
            "month": month_str,
            "limit_amount": "1000.00",
        },
    )
    r = client.post(
        "/budgets",
        headers=auth_headers,
        json={
            "category_id": None,
            "month": month_str,
            "limit_amount": "2000.00",
        },
    )
    # Either 400 (service error) or 409 (DB conflict) — accept either
    assert r.status_code in (400, 409), r.text
