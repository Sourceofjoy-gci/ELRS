import pytest

def test_chat_sync_unauthorized(client):
    """Chat sync without auth should return 403 (HTTPBearer behavior when no header)."""
    response = client.post(
        "/api/v1/chat/sync",
        json={"query": "Test query"},
    )
    # HTTPBearer returns 403 when no Authorization header is provided (auto_error=True)
    assert response.status_code == 403

def test_chat_sessions_unauthorized(client):
    """Sessions list without auth should return 403 (HTTPBearer behavior when no header)."""
    response = client.get("/api/v1/chat/sessions")
    # HTTPBearer returns 403 when no Authorization header is provided (auto_error=True)
    assert response.status_code == 403
