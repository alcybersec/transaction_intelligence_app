"""TDD: PATCH /ai/settings persists to app_settings KV store."""

from __future__ import annotations


def test_patch_persists_base_url(client, auth_headers):
    r = client.patch(
        "/ai/settings",
        headers=auth_headers,
        json={"ollama_base_url": "http://ollama:11434", "ollama_model": "llama3"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ollama_base_url"] == "http://ollama:11434"
    assert body["ollama_model"] == "llama3"


def test_get_returns_persisted(client, auth_headers):
    client.patch(
        "/ai/settings",
        headers=auth_headers,
        json={"ollama_base_url": "http://x:11434", "ollama_model": "phi3"},
    )
    r = client.get("/ai/settings", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["ollama_base_url"] == "http://x:11434"
    assert body["ollama_model"] == "phi3"


def test_feature_toggles_persist(client, auth_headers):
    r = client.patch(
        "/ai/settings",
        headers=auth_headers,
        json={"features": {"chat": False, "categorize": True, "parse": True}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["features"]["chat"] is False
    assert body["features"]["categorize"] is True

    # Subsequent partial update should merge, not replace
    r2 = client.patch(
        "/ai/settings",
        headers=auth_headers,
        json={"features": {"chat": True}},
    )
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["features"]["chat"] is True
    assert body2["features"]["categorize"] is True
    assert body2["features"]["parse"] is True
