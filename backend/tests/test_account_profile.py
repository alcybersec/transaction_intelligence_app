"""TDD: PATCH /auth/me + DELETE /auth/me."""

from __future__ import annotations


def test_get_me_returns_email_and_prefs(client, auth_headers):
    r = client.get("/auth/me", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "email" in body
    assert "display_name" in body
    assert "preferences" in body


def test_patch_display_name(client, auth_headers):
    r = client.patch("/auth/me", headers=auth_headers, json={"display_name": "Alex"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Alex"


def test_patch_email_validates(client, auth_headers):
    r = client.patch("/auth/me", headers=auth_headers, json={"email": "not-an-email"})
    assert r.status_code == 422


def test_patch_preferences_merges(client, auth_headers):
    r = client.patch("/auth/me", headers=auth_headers, json={"preferences": {"currency": "AED"}})
    assert r.json()["preferences"]["currency"] == "AED"
    r2 = client.patch(
        "/auth/me", headers=auth_headers, json={"preferences": {"date_format": "iso"}}
    )
    assert r2.json()["preferences"]["currency"] == "AED"
    assert r2.json()["preferences"]["date_format"] == "iso"


def test_delete_account(client, auth_headers, test_user, db_session):
    from app.db.models.user import User

    r = client.delete("/auth/me", headers=auth_headers)
    assert r.status_code == 204
    assert db_session.query(User).filter(User.id == test_user.id).first() is None
