import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.retrieval.embedder import get_embedder
from app.retrieval.reranker import get_reranker
from app.retrieval.vector_store import VectorStore
from app.retrieval.bm25_store import BM25Store
from app.retrieval.models import RetrievedChunk
from app.core.observability import trace_retrieval

logger = logging.getLogger(__name__)
settings = get_settings()


class HybridRetriever:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedder = get_embedder()
        self.reranker = get_reranker()
        self.vector_store = VectorStore(db)
        self.bm25_store = BM25Store(db)

    def _reciprocal_rank_fusion(
        self,
        ranked_lists: List[List[RetrievedChunk]],
        k: int = 60,
    ) -> List[RetrievedChunk]:
        chunk_scores: Dict[str, Dict[str, Any]] = {}

        for ranked_list in ranked_lists:
            for rank, chunk in enumerate(ranked_list, start=1):
                chunk_id = chunk.id
                if chunk_id not in chunk_scores:
                    chunk_scores[chunk_id] = {
                        "chunk": chunk,
                        "rrf_score": 0.0,
                        "vector_score": chunk.vector_score,
                        "bm25_score": chunk.bm25_score,
                    }
                chunk_scores[chunk_id]["rrf_score"] += 1.0 / (k + rank)

        sorted_chunks = sorted(
            chunk_scores.values(),
            key=lambda x: x["rrf_score"],
            reverse=True,
        )

        result = []
        for item in sorted_chunks:
            chunk = item["chunk"]
            chunk.rrf_score = item["rrf_score"]
            result.append(chunk)

        return result

    async def retrieve(
        self,
        query: str,
        top_k: int = 8,
        filters: Optional[Dict[str, Any]] = None,
        rrf_k: int = None,
    ) -> List[RetrievedChunk]:
        if rrf_k is None:
            rrf_k = settings.retrieval_rrf_k

        reranker_candidates = settings.retrieval_reranker_candidates

        logger.info(f"Starting hybrid retrieval for query: {query[:50]}...")

        query_embedding = await self.embedder.embed_query(query)

        vector_results = await self.vector_store.similarity_search(
            query_embedding=query_embedding,
            top_k=reranker_candidates,
            filters=filters,
        )
        bm25_results = await self.bm25_store.keyword_search(
            query=query,
            top_k=reranker_candidates,
            filters=filters,
        )

        trace_retrieval(
            None,  # trace span not available in retrieval layer
            query,
            len(vector_results),
            max(v.vector_score for v in vector_results) if vector_results else 0,
            "hybrid"
        )

        fused_results = self._reciprocal_rank_fusion(
            [vector_results, bm25_results],
            k=rrf_k,
        )

        if len(fused_results) > reranker_candidates:
            fused_results = fused_results[:reranker_candidates]

        candidate_texts = [chunk.content for chunk in fused_results]

        if candidate_texts:
            reranked = await self.reranker.rerank(query, candidate_texts, top_k=top_k)
            rerank_map = {idx: score for idx, score in reranked}

            for chunk in fused_results:
                if chunk.id in rerank_map:
                    for rc in candidate_texts:
                        idx = candidate_texts.index(rc)
                        if idx in rerank_map:
                            chunk.reranker_score = rerank_map[idx]
                            break

            reranked_chunks = []
            for idx, score in reranked:
                if idx < len(fused_results):
                    fused_results[idx].reranker_score = score
                    reranked_chunks.append(fused_results[idx])

            return reranked_chunks[:top_k]

        return fused_results[:top_k]
