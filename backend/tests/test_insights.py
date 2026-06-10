"""TDD: GET /analytics/insights."""
from __future__ import annotations


def test_empty_history_returns_safe_defaults(client, auth_headers):
    r = client.get(
        "/analytics/insights?period_start=2026-06-01&period_end=2026-06-30",
        headers=auth_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["subscriptions_count"] == 0
    assert body["top_merchant_alt"] is None
    assert body["budget_forecast"] is None
    assert body["spending_trend"] in ("up", "down", "flat", None)


def test_insights_includes_spending_trend(client, auth_headers):
    r = client.get(
        "/analytics/insights?period_start=2026-06-01&period_end=2026-06-30",
        headers=auth_headers,
    )
    body = r.json()
    assert "spending_trend" in body
    assert "spending_change_percentage" in body
