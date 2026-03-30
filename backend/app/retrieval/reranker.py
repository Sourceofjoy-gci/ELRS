import logging
from typing import List, Tuple, Optional
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class TEIUnavailableError(Exception):
    pass


class LocalReranker:
    """TEI-based reranker (deprecated - use OllamaReranker instead)."""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.tei_reranker_url
        self._client = None

    async def rerank(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 10
    ) -> List[Tuple[int, float]]:
        raise TEIUnavailableError("TEI reranker is deprecated")


class OllamaReranker:
    """Fast reranker using keyword overlap (avoiding slow embedding-based reranking)."""

    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or settings.ollama_base_url
        self.model = model or "nomic-embed-text"

    async def rerank(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 10
    ) -> List[Tuple[int, float]]:
        if not candidates:
            return []

        # Simple keyword overlap scoring (fast, no network calls)
        query_words = set(query.lower().split())
        query_words = {w for w in query_words if len(w) > 2}  # Skip short words

        scored = []
        for idx, candidate in enumerate(candidates):
            candidate_words = set(candidate.lower().split())
            candidate_words = {w for w in candidate_words if len(w) > 2}

            # Jaccard-like overlap score
            overlap = len(query_words & candidate_words)
            score = overlap / len(query_words | candidate_words) if (query_words | candidate_words) else 0
            scored.append((idx, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    async def health_check(self) -> bool:
        return True


_reranker: Optional[OllamaReranker] = None


def get_reranker() -> OllamaReranker:
    global _reranker
    if _reranker is None:
        _reranker = OllamaReranker()
    return _reranker
