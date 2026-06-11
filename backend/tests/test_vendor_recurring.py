"""TDD: vendor is_recurring toggle."""

from __future__ import annotations

import uuid


def _make_vendor(db_session, *, name="Test Vendor", is_recurring=False):
    from app.db.models.vendor import Vendor

    v = Vendor(
        id=uuid.uuid4(),
        canonical_name=name,
    )
    if is_recurring:
        v.is_recurring = True
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v


def test_default_vendor_is_recurring_is_false(db_session):
    v = _make_vendor(db_session)
    assert v.is_recurring is False


def test_vendor_response_includes_is_recurring(client, auth_headers, db_session):
    _make_vendor(db_session, name="Spinneys")
    r = client.get("/vendors", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "vendors" in body
    if body["vendors"]:
        assert "is_recurring" in body["vendors"][0]


def test_patch_vendor_recurring_to_true(client, auth_headers, db_session):
    v = _make_vendor(db_session, name="Netflix")
    r = client.patch(
        f"/vendors/{v.id}",
        headers=auth_headers,
        json={"is_recurring": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_recurring"] is True


def test_patch_vendor_recurring_to_false(client, auth_headers, db_session):
    v = _make_vendor(db_session, name="Netflix", is_recurring=True)
    r = client.patch(
        f"/vendors/{v.id}",
        headers=auth_headers,
        json={"is_recurring": False},
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_recurring"] is False


def test_patch_unknown_vendor_returns_404(client, auth_headers):
    r = client.patch(
        f"/vendors/{uuid.uuid4()}",
        headers=auth_headers,
        json={"is_recurring": True},
    )
    assert r.status_code == 404
