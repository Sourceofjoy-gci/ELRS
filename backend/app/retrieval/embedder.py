import httpx
import logging
from typing import List, Optional
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class TEIUnavailableError(Exception):
    pass


class LocalEmbedder:
    def __init__(
        self,
        base_url: str = None,
        dimensions: int = None,
        batch_size: int = None,
    ):
        self.base_url = base_url or settings.tei_embeddings_url
        self.dimensions = dimensions or settings.tei_embedding_dimensions
        self.batch_size = batch_size or settings.tei_batch_size
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

    async def embed_query(self, text: str) -> List[float]:
        client = await self._get_client()
        prefixed_text = f"search_query: {text}"

        try:
            response = await client.post(
                "/embed",
                json={"inputs": [prefixed_text], "normalize": True}
            )

            if response.status_code != 200:
                raise TEIUnavailableError(f"TEI returned status {response.status_code}")

            data = response.json()
            embeddings = data.get("embeddings", [])

            if not embeddings or len(embeddings[0]) != self.dimensions:
                raise TEIUnavailableError(
                    f"Invalid embedding dimensions: expected {self.dimensions}, "
                    f"got {len(embeddings[0]) if embeddings else 'empty'}"
                )

            return embeddings[0]

        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to TEI embeddings at {self.base_url}: {e}")
            raise TEIUnavailableError(f"TEI embeddings is unreachable at {self.base_url}")

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        client = await self._get_client()
        prefixed_texts = [f"search_document: {text}" for text in texts]
        all_embeddings = []

        for i in range(0, len(prefixed_texts), self.batch_size):
            batch = prefixed_texts[i:i + self.batch_size]

            try:
                response = await client.post(
                    "/embed",
                    json={"inputs": batch, "normalize": True}
                )

                if response.status_code != 200:
                    raise TEIUnavailableError(f"TEI returned status {response.status_code}")

                data = response.json()
                batch_embeddings = data.get("embeddings", [])

                for emb in batch_embeddings:
                    if len(emb) != self.dimensions:
                        raise TEIUnavailableError(
                            f"Invalid embedding dimensions: expected {self.dimensions}, "
                            f"got {len(emb)}"
                        )
                    all_embeddings.append(emb)

            except httpx.ConnectError as e:
                logger.error(f"Failed to connect to TEI embeddings at {self.base_url}: {e}")
                raise TEIUnavailableError(f"TEI embeddings is unreachable at {self.base_url}")

        return all_embeddings

    async def health_check(self) -> bool:
        try:
            client = await self._get_client()
            response = await client.get("/health")
            return response.status_code == 200
        except Exception:
            return False


_embedder: Optional[LocalEmbedder] = None


def get_embedder() -> LocalEmbedder:
    global _embedder
    if _embedder is None:
        _embedder = LocalEmbedder()
    return _embedder
