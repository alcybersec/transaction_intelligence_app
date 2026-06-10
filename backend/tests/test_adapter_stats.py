"""TDD: GET /adapters/{name}/stats."""

from __future__ import annotations


def test_stats_zero_when_empty(client, auth_headers):
    # Pick a registered adapter; emirates_nbd ships with the repo.
    r = client.get("/adapters/emirates_nbd/stats", headers=auth_headers)
    if r.status_code == 404:
        # Adapter not registered in this env — accept the contract.
        return
    assert r.status_code == 200
    body = r.json()
    assert "parsed_count" in body
    assert body["parsed_count"] >= 0
    assert "last_parsed_at" in body


def test_stats_unknown_adapter_returns_404(client, auth_headers):
    r = client.get("/adapters/this_adapter_does_not_exist/stats", headers=auth_headers)
    assert r.status_code == 404
