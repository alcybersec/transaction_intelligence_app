"""TDD: TOTP-based 2FA."""

from __future__ import annotations

import pyotp


def test_enable_returns_secret(client, auth_headers):
    r = client.post("/auth/2fa/enable", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "secret" in body
    assert "otpauth_url" in body


def test_verify_with_correct_code(client, auth_headers):
    enable = client.post("/auth/2fa/enable", headers=auth_headers).json()
    code = pyotp.TOTP(enable["secret"]).now()
    r = client.post(
        "/auth/2fa/verify",
        headers=auth_headers,
        json={"code": code},
    )
    assert r.status_code == 200
    assert r.json()["verified"] is True


def test_verify_with_wrong_code(client, auth_headers):
    client.post("/auth/2fa/enable", headers=auth_headers)
    r = client.post(
        "/auth/2fa/verify",
        headers=auth_headers,
        json={"code": "000000"},
    )
    assert r.status_code == 400


def test_disable_clears_secret(client, auth_headers):
    enable = client.post("/auth/2fa/enable", headers=auth_headers).json()
    code = pyotp.TOTP(enable["secret"]).now()
    client.post("/auth/2fa/verify", headers=auth_headers, json={"code": code})
    r = client.delete("/auth/2fa", headers=auth_headers)
    assert r.status_code == 204
