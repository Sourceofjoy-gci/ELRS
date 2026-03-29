import pytest
import httpx
import respx
from backend.app.retrieval.reranker import LocalReranker, TEIUnavailableError


@pytest.fixture
def reranker():
    return LocalReranker(base_url="http://localhost:8081")


@pytest.mark.asyncio
async def test_rerank_returns_sorted_tuples(reranker):
    mock_response = {
        "results": [
            {"index": 2, "score": 0.95},
            {"index": 0, "score": 0.88},
            {"index": 1, "score": 0.75},
        ]
    }

    with respx.mock:
        respx.post("http://localhost:8081/rerank").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        result = await reranker.rerank("termination", ["A", "B", "C"], top_k=3)

        assert isinstance(result, list)
        assert len(result) == 3
        scores = [score for _, score in result]
        assert scores == sorted(scores, reverse=True)


@pytest.mark.asyncio
async def test_rerank_respects_top_k(reranker):
    mock_response = {
        "results": [
            {"index": 0, "score": 0.95},
            {"index": 1, "score": 0.88},
            {"index": 2, "score": 0.75},
            {"index": 3, "score": 0.70},
            {"index": 4, "score": 0.65},
        ]
    }

    with respx.mock:
        respx.post("http://localhost:8081/rerank").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        result = await reranker.rerank("termination", ["A", "B", "C", "D", "E"], top_k=2)

        assert len(result) == 2


@pytest.mark.asyncio
async def test_raises_tei_unavailable(reranker):
    with respx.mock:
        respx.post("http://localhost:8081/rerank").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with pytest.raises(TEIUnavailableError):
            await reranker.rerank("test", ["A", "B"])
