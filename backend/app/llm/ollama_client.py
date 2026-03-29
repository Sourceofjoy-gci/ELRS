import httpx
import logging
from typing import List, Dict, Any, Optional, AsyncIterator
from app.core.config import get_settings
from app.core.observability import trace_llm_request

logger = logging.getLogger(__name__)
settings = get_settings()


class OllamaUnavailableError(Exception):
    pass


class OllamaClient:
    def __init__(
        self,
        base_url: str = None,
        primary_model: str = None,
        fallback_model: str = None,
        router_model: str = None,
        temperature: float = None,
        num_ctx: int = None,
        timeout: float = None,
    ):
        self.base_url = base_url or settings.ollama_base_url
        self.primary_model = primary_model or settings.ollama_primary_model
        self.fallback_model = fallback_model or settings.ollama_fallback_model
        self.router_model = router_model or settings.ollama_router_model
        self.temperature = temperature if temperature is not None else settings.ollama_temperature
        self.num_ctx = num_ctx or settings.ollama_num_ctx
        self.timeout = timeout or settings.ollama_request_timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        stream: bool = False,
        temperature: float = None,
        num_ctx: int = None,
        options: Dict[str, Any] = None,
    ) -> Dict[str, Any] | AsyncIterator[str]:
        if model is None:
            model = self.primary_model

        client = await self._get_client()

        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "num_ctx": num_ctx or self.num_ctx,
            },
        }
        if options:
            payload["options"].update(options)

        try:
            response = await client.post("/api/chat", json=payload)

            if response.status_code == 599:
                if model == self.primary_model and self.fallback_model:
                    logger.warning(f"Primary model {model} timeout, retrying with fallback {self.fallback_model}")
                    payload["model"] = self.fallback_model
                    response = await client.post("/api/chat", json=payload)

            if response.status_code != 200:
                raise OllamaUnavailableError(f"Ollama returned status {response.status_code}")

            await trace_llm_request(model, messages, response.status_code)

            if stream:
                return self._stream_response(response)
            else:
                data = response.json()
                return data

        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to Ollama at {self.base_url}: {e}")
            raise OllamaUnavailableError(f"Ollama is unreachable at {self.base_url}")

    async def _stream_response(self, response: httpx.Response) -> AsyncIterator[str]:
        async for line in response.aiter_lines():
            if line.strip():
                import json
                try:
                    data = json.loads(line)
                    if "message" in data and "content" in data["message"]:
                        yield data["message"]["content"]
                except json.JSONDecodeError:
                    continue

    async def complete(
        self,
        prompt: str,
        model: str = None,
        stream: bool = False,
        temperature: float = None,
    ) -> str | AsyncIterator[str]:
        if model is None:
            model = self.primary_model

        client = await self._get_client()

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
            },
        }

        try:
            response = await client.post("/api/generate", json=payload)

            if response.status_code != 200:
                raise OllamaUnavailableError(f"Ollama returned status {response.status_code}")

            if stream:
                return self._stream_response(response)
            else:
                data = response.json()
                return data.get("response", "")

        except httpx.ConnectError as e:
            logger.error(f"Failed to connect to Ollama at {self.base_url}: {e}")
            raise OllamaUnavailableError(f"Ollama is unreachable at {self.base_url}")

    async def check_model_available(self, model: str) -> bool:
        try:
            client = await self._get_client()
            response = await client.get("/api/tags")
            if response.status_code != 200:
                return False
            data = response.json()
            models = data.get("models", [])
            return any(m.get("name") == model for m in models)
        except Exception:
            return False

    async def list_models(self) -> List[str]:
        try:
            client = await self._get_client()
            response = await client.get("/api/tags")
            if response.status_code != 200:
                return []
            data = response.json()
            return [m.get("name") for m in data.get("models", [])]
        except Exception:
            return []

    async def pull_model(self, model: str) -> AsyncIterator[Dict[str, Any]]:
        client = await self._get_client()
        async with client.stream("POST", "/api/pull", json={"name": model}) as response:
            async for line in response.aiter_lines():
                if line.strip():
                    import json
                    try:
                        data = json.loads(line)
                        yield data
                    except json.JSONDecodeError:
                        continue

    async def ensure_models_loaded(self, models: List[str]) -> None:
        available = await self.list_models()
        for model in models:
            if model not in available:
                logger.info(f"Model {model} not available, pulling...")
                async for progress in self.pull_model(model):
                    if progress.get("status") == "success":
                        logger.info(f"Model {model} pulled successfully")

    async def health_check(self) -> bool:
        try:
            client = await self._get_client()
            response = await client.get("/api/tags")
            return response.status_code == 200
        except Exception:
            return False


_ollama_client: Optional[OllamaClient] = None


def get_ollama_client() -> OllamaClient:
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = OllamaClient()
    return _ollama_client
