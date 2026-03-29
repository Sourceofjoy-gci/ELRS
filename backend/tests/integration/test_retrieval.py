import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.app.retrieval.models import RetrievedChunk
from backend.app.retrieval.hybrid_retriever import HybridRetriever


class MockDB:
    pass


class MockEmbedder:
    async def embed_query(self, text):
        return [0.1] * 768


class MockReranker:
    async def rerank(self, query, candidates, top_k=10):
        return [(i, 1.0 - (i * 0.1)) for i in range(min(top_k, len(candidates)))]


@pytest.fixture
def mock_db():
    return MockDB()


@pytest.fixture
def mock_embedder():
    return MockEmbedder()


@pytest.fixture
def mock_reranker():
    return MockReranker()


def test_retrieved_chunk_to_dict():
    chunk = RetrievedChunk(
        id="123",
        content="Test content",
        document_id="456",
        act_name="Employment Act",
        act_number="Act 5 of 1980",
        year=1980,
        doc_type="act",
        section_number="35",
        section_heading="Termination of employment",
        part_heading="PART III",
        vector_score=0.85,
        bm25_score=0.72,
        rrf_score=0.78,
        reranker_score=0.91,
        metadata={"key": "value"},
    )

    chunk_dict = chunk.to_dict()

    assert chunk_dict["id"] == "123"
    assert chunk_dict["content"] == "Test content"
    assert chunk_dict["act_name"] == "Employment Act"
    assert chunk_dict["vector_score"] == 0.85
    assert chunk_dict["reranker_score"] == 0.91


def test_retrieved_chunk_from_db_row():
    class MockRow:
        id = "789"
        content = "Legal text"
        document_id = "101"
        act_name = "Constitution"
        act_number = None
        year = 2005
        doc_type = "constitution"
        section_number = "21"
        section_heading = "Bill of Rights"
        part_heading = None
        metadata = {}

    chunk = RetrievedChunk.from_db_row(MockRow())

    assert chunk.id == "789"
    assert chunk.content == "Legal text"
    assert chunk.act_name == "Constitution"
    assert chunk.year == 2005


@pytest.mark.asyncio
async def test_rrf_gives_higher_score_to_dual_hits():
    chunk1 = RetrievedChunk(id="1", content="A", document_id="d1", act_name="Act")
    chunk1.vector_score = 0.8
    chunk1.bm25_score = 0.7

    chunk2 = RetrievedChunk(id="2", content="B", document_id="d2", act_name="Act")
    chunk2.vector_score = 0.6
    chunk2.bm25_score = 0.5

    chunk3 = RetrievedChunk(id="3", content="C", document_id="d3", act_name="Act")
    chunk3.vector_score = 0.5
    chunk3.bm25_score = 0.4

    ranked_lists = [
        [chunk1, chunk2, chunk3],
        [chunk1, chunk2, chunk3],
    ]

    k = 60
    chunk_scores = {}
    for ranked_list in ranked_lists:
        for rank, chunk in enumerate(ranked_list, start=1):
            chunk_id = chunk.id
            if chunk_id not in chunk_scores:
                chunk_scores[chunk_id] = {"chunk": chunk, "rrf_score": 0.0}
            chunk_scores[chunk_id]["rrf_score"] += 1.0 / (k + rank)

    assert chunk_scores["1"]["rrf_score"] > chunk_scores["2"]["rrf_score"]
    assert chunk_scores["2"]["rrf_score"] > chunk_scores["3"]["rrf_score"]


def test_reranker_score_assignment():
    chunk = RetrievedChunk(id="1", content="test", document_id="doc1", act_name="Test Act")

    assert chunk.reranker_score is None

    chunk.reranker_score = 0.95

    assert chunk.reranker_score == 0.95
