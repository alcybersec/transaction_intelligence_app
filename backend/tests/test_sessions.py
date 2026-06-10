"""TDD: session listing + revocation."""

from __future__ import annotations


def test_login_creates_session(client, db_session, test_user):
    r = client.post(
        "/auth/login",
        json={"username": test_user.username, "password": "pw"},
    )
    assert r.status_code == 200
    # Session row should exist
    from app.db.models.user_session import UserSession

    sessions = (
        db_session.query(UserSession).filter(UserSession.user_id == test_user.id).all()
    )
    assert len(sessions) == 1


def test_list_sessions(client, auth_headers):
    r = client.get("/auth/sessions", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_revoke_all_sessions(client, auth_headers):
    r = client.delete("/auth/sessions", headers=auth_headers)
    assert r.status_code == 204
