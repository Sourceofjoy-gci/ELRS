import httpx
import logging
from typing import List, Tuple, Optional
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class TEIUnavailableError(Exception):
    pass


class LocalReranker:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.tei_reranker_url
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(60.0),
                limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def rerank(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 10
    ) -> List[Tuple[int, float]]:
        if not candidates:
            return []

        client = await self._get_client()

        try:
            response = await client.post(
                "/rerank",
                json={
                    "query": query,
                    "texts": candidates,
                    "top_n": top_k,
                    "return_text": False
                }
            )

            if response.status_code != 200:
                raise TEIUnavailableError(f"TEI reranker returned status {response.status_code}")

            data = response.json()
            results = data.get("results", [])

            scored_results = []
            for result in results:
                index = result.get("index", 0)
                score = result.get("score", 0.0)
                scored_results.append((index, score))

            scored_results.sort(key=lambda x: x[1], reverse=True)
            return scored_results[:top_k]

        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to TEI reranker at {self.base_url}: {e}")
            raise TEIUnavailableError(f"TEI reranker is unreachable at {self.base_url}")

    async def health_check(self) -> bool:
        try:
            client = await self._get_client()
            response = await client.get("/health")
            return response.status_code == 200
        except Exception:
            return False


_reranker: Optional[LocalReranker] = None


def get_reranker() -> LocalReranker:
    global _reranker
    if _reranker is None:
        _reranker = LocalReranker()
    return _reranker
