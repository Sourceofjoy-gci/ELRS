import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
import respx
from backend.app.llm.ollama_client import OllamaClient, OllamaUnavailableError


@pytest.fixture
def client():
    return OllamaClient(
        base_url="http://localhost:11434",
        primary_model="mistral:7b-instruct-q4_K_M",
        fallback_model="llama3.1:8b-instruct-q4_K_M",
    )


@pytest.mark.asyncio
async def test_chat_returns_dict(client):
    mock_response = {
        "model": "mistral:7b-instruct-q4_K_M",
        "message": {"role": "assistant", "content": "Hello!"},
        "done": True,
    }

    with respx.mock:
        respx.post("http://localhost:11434/api/chat").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        result = await client.chat([{"role": "user", "content": "hello"}])

        assert isinstance(result, dict)
        assert "message" in result
        assert result["message"]["content"] == "Hello!"


@pytest.mark.asyncio
async def test_chat_streaming_yields_tokens(client):
    mock_response = httpx.Response(
        200,
        text='{"message": {"content": "Hello"}}',
    )

    with respx.mock:
        respx.post("http://localhost:11434/api/chat").mock(
            return_value=mock_response
        )

        result = await client.chat(
            [{"role": "user", "content": "hello"}],
            stream=True
        )

        tokens = []
        async for token in result:
            tokens.append(token)

        assert len(tokens) > 0


@pytest.mark.asyncio
async def test_check_model_available_true(client):
    mock_response = {
        "models": [
            {"name": "mistral:7b-instruct-q4_K_M", "size": 4000000000},
            {"name": "llama3.1:8b-instruct-q4_K_M", "size": 4700000000},
        ]
    }

    with respx.mock:
        respx.get("http://localhost:11434/api/tags").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        result = await client.check_model_available("mistral:7b-instruct-q4_K_M")

        assert result is True


@pytest.mark.asyncio
async def test_check_model_available_false(client):
    mock_response = {
        "models": [
            {"name": "llama3.1:8b-instruct-q4_K_M", "size": 4700000000},
        ]
    }

    with respx.mock:
        respx.get("http://localhost:11434/api/tags").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        result = await client.check_model_available("mistral:7b-instruct-q4_K_M")

        assert result is False


@pytest.mark.asyncio
async def test_fallback_on_timeout(client):
    primary_response = httpx.Response(599)
    fallback_response = {
        "model": "llama3.1:8b-instruct-q4_K_M",
        "message": {"role": "assistant", "content": "Fallback response"},
        "done": True,
    }

    with respx.mock:
        route1 = respx.post("http://localhost:11434/api/chat")
        route1.mock(side_effect=[primary_response, httpx.Response(200, json=fallback_response)])

        result = await client.chat([{"role": "user", "content": "hello"}])

        assert isinstance(result, dict)
        assert "message" in result


@pytest.mark.asyncio
async def test_raises_ollama_unavailable(client):
    with respx.mock:
        respx.post("http://localhost:11434/api/chat").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with pytest.raises(OllamaUnavailableError):
            await client.chat([{"role": "user", "content": "hello"}])


def test_no_external_urls(client):
    assert client.base_url.startswith("http://")
    assert "api_key" not in str(client.__dict__)
