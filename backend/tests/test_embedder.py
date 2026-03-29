import pytest
import httpx
import respx
from backend.app.retrieval.embedder import LocalEmbedder, TEIUnavailableError


@pytest.fixture
def embedder():
    return LocalEmbedder(
        base_url="http://localhost:8080",
        dimensions=768,
        batch_size=32,
    )


@pytest.fixture
def mock_768_embedding():
    return [0.1] * 768


@pytest.mark.asyncio
async def test_embed_query_returns_768_floats(embedder, mock_768_embedding):
    with respx.mock:
        respx.post("http://localhost:8080/embed").mock(
            return_value=httpx.Response(200, json={"embeddings": [mock_768_embedding]})
        )

        result = await embedder.embed_query("employment termination")

        assert isinstance(result, list)
        assert len(result) == 768
        assert all(isinstance(x, float) for x in result)


@pytest.mark.asyncio
async def test_embed_query_prepends_prefix(embedder, mock_768_embedding):
    with respx.mock:
        route = respx.post("http://localhost:8080/embed")
        route.mock(return_value=httpx.Response(200, json={"embeddings": [mock_768_embedding]}))

        await embedder.embed_query("termination")

        request_body = route.calls[0].request.content.decode()
        assert "search_query:" in request_body


@pytest.mark.asyncio
async def test_embed_documents_prepends_prefix(embedder, mock_768_embedding):
    with respx.mock:
        route = respx.post("http://localhost:8080/embed")
        route.mock(return_value=httpx.Response(200, json={"embeddings": [mock_768_embedding, mock_768_embedding]}))

        await embedder.embed_documents(["text1", "text2"])

        request_body = route.calls[0].request.content.decode()
        assert "search_document:" in request_body


@pytest.mark.asyncio
async def test_embed_documents_batches_correctly(embedder, mock_768_embedding):
    with respx.mock:
        respx.post("http://localhost:8080/embed").mock(
            return_value=httpx.Response(200, json={"embeddings": [mock_768_embedding]})
        )

        texts = [f"document {i}" for i in range(100)]
        await embedder.embed_documents(texts)

        assert len(respx.calls) >= 4


@pytest.mark.asyncio
async def test_raises_tei_unavailable(embedder):
    with respx.mock:
        respx.post("http://localhost:8080/embed").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with pytest.raises(TEIUnavailableError):
            await embedder.embed_query("test")
