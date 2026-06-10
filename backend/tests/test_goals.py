"""TDD: savings goals CRUD + contribute."""

from __future__ import annotations


def test_create_goal(client, auth_headers):
    r = client.post(
        "/goals",
        headers=auth_headers,
        json={
            "name": "Emergency fund",
            "target_amount": "5000.00",
            "target_date": "2026-12-31",
            "color": "#10b981",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Emergency fund"
    assert body["target_amount"] == "5000.00"
    assert body["saved_amount"] == "0.00"


def test_list_goals_scoped_to_user(client, auth_headers, db_session, test_user):
    client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"},
    )
    client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "B", "target_amount": "200.00", "target_date": "2026-12-31"},
    )
    r = client.get("/goals", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_patch_goal(client, auth_headers):
    cr = client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"},
    ).json()
    r = client.patch(
        f"/goals/{cr['id']}",
        headers=auth_headers,
        json={"name": "Renamed"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"


def test_delete_goal(client, auth_headers):
    cr = client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"},
    ).json()
    r = client.delete(f"/goals/{cr['id']}", headers=auth_headers)
    assert r.status_code == 204
    lst = client.get("/goals", headers=auth_headers).json()
    assert lst == []


def test_contribute_increments_saved_amount(client, auth_headers):
    cr = client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "A", "target_amount": "100.00", "target_date": "2026-12-31"},
    ).json()
    r = client.post(
        f"/goals/{cr['id']}/contribute",
        headers=auth_headers,
        json={"amount": "30.00"},
    )
    assert r.status_code == 200
    assert r.json()["saved_amount"] == "30.00"


def test_contribute_clamps_to_target(client, auth_headers):
    cr = client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "A", "target_amount": "10.00", "target_date": "2026-12-31"},
    ).json()
    r = client.post(
        f"/goals/{cr['id']}/contribute",
        headers=auth_headers,
        json={"amount": "100.00"},
    )
    assert r.status_code == 200
    assert r.json()["saved_amount"] == "10.00"


def test_target_date_must_be_future(client, auth_headers):
    r = client.post(
        "/goals",
        headers=auth_headers,
        json={"name": "A", "target_amount": "100.00", "target_date": "2000-01-01"},
    )
    assert r.status_code == 422
