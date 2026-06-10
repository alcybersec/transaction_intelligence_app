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


def test_login_response_includes_email_and_preferences(client, db_session, test_user):
    test_user.email = "alex@example.com"
    test_user.preferences = {"currency": "AED", "date_format": "iso"}
    db_session.commit()
    r = client.post("/auth/login", json={"username": test_user.username, "password": "pw"})
    assert r.status_code == 200, r.text
    body = r.json()
    user = body["user"] if "user" in body else body  # accommodate either nested or flat shape
    assert user["email"] == "alex@example.com"
    assert user["preferences"]["currency"] == "AED"


def test_email_normalized_on_patch(client, auth_headers):
    r = client.patch("/auth/me", headers=auth_headers,
                     json={"email": "  Foo@Bar.COM "})
    assert r.status_code == 200
    assert r.json()["email"] == "foo@bar.com"


def test_email_must_be_unique(client, auth_headers, db_session, test_user):
    # Create a second user with email "taken@example.com" by patching test_user first
    client.patch("/auth/me", headers=auth_headers,
                 json={"email": "taken@example.com"})

    # Create a second user manually
    import uuid
    from app.db.models.user import User
    from app.services.auth import hash_password, create_access_token
    u2 = User(
        id=uuid.uuid4(),
        username=f"u2_{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("pw"),
        is_active=True, is_admin=False,
    )
    db_session.add(u2)
    db_session.commit()
    u2_headers = {"Authorization": f"Bearer {create_access_token(user_id=u2.id)}"}

    r = client.patch("/auth/me", headers=u2_headers,
                     json={"email": "TAKEN@example.com"})  # different case
    assert r.status_code == 409, r.text


def test_email_null_can_repeat(db_session, test_user):
    # Multiple users with NULL email is fine (unique constraint must be partial)
    import uuid
    from app.db.models.user import User
    from app.services.auth import hash_password
    u2 = User(
        id=uuid.uuid4(),
        username=f"u2_{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("pw"),
        email=None,
        is_active=True, is_admin=False,
    )
    db_session.add(u2)
    db_session.commit()  # should not raise
