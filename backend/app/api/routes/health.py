import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from app.core.config import get_settings
from app.core.security import get_current_user
from app.llm.ollama_client import get_ollama_client
from app.retrieval.embedder import get_embedder
from app.retrieval.reranker import get_reranker
from app.core.database import engine
from redis.asyncio import Redis
import redis.asyncio as redis

router = APIRouter()
settings = get_settings()


@router.get("")
async def health_check():
    return {
        "status": "healthy",
        "service": "ELRI Backend",
        "version": "1.0.0",
    }


@router.get("/models")
async def models_health(
    current_user: dict = Depends(get_current_user)
):
    status_response = {
        "ollama": {"status": "unknown", "models": {}},
        "embeddings": {"status": "unknown", "model": "nomic-ai/nomic-embed-text-v1.5", "dimensions": 768},
        "reranker": {"status": "unknown", "model": "cross-encoder/ms-marco-MiniLM-L-6-v2"},
        "postgres": {"status": "unknown"},
        "redis": {"status": "unknown"},
        "minio": {"status": "unknown"},
    }

    ollama = get_ollama_client()
    try:
        if await ollama.health_check():
            status_response["ollama"]["status"] = "healthy"
            models = await ollama.list_models()
            model_status = {
                "mistral:7b-instruct-q4_K_M": {"loaded": "mistral:7b-instruct-q4_K_M" in models},
                "llama3.1:8b-instruct-q4_K_M": {"loaded": "llama3.1:8b-instruct-q4_K_M" in models},
                "phi3:mini-instruct-q4": {"loaded": "phi3:mini-instruct-q4" in models},
            }
            status_response["ollama"]["models"] = model_status
            status_response["ollama"]["primary_model"] = settings.ollama_primary_model
            status_response["ollama"]["primary_loaded"] = model_status.get(settings.ollama_primary_model, {}).get("loaded", False)
            status_response["ollama"]["fallback_model"] = settings.ollama_fallback_model
            status_response["ollama"]["fallback_loaded"] = model_status.get(settings.ollama_fallback_model, {}).get("loaded", False)
            status_response["ollama"]["router_model"] = settings.ollama_router_model
            status_response["ollama"]["router_loaded"] = model_status.get(settings.ollama_router_model, {}).get("loaded", False)
        else:
            status_response["ollama"]["status"] = "unhealthy"
    except Exception as e:
        status_response["ollama"]["status"] = f"error: {str(e)}"

    embedder = get_embedder()
    try:
        if await embedder.health_check():
            status_response["embeddings"]["status"] = "healthy"
        else:
            status_response["embeddings"]["status"] = "unhealthy"
    except Exception as e:
        status_response["embeddings"]["status"] = f"error: {str(e)}"

    reranker = get_reranker()
    try:
        if await reranker.health_check():
            status_response["reranker"]["status"] = "healthy"
        else:
            status_response["reranker"]["status"] = "unhealthy"
    except Exception as e:
        status_response["reranker"]["status"] = f"error: {str(e)}"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            status_response["postgres"]["status"] = "healthy"
    except Exception as e:
        status_response["postgres"]["status"] = f"error: {str(e)}"

    try:
        redis_client = redis.from_url(settings.redis_url)
        await redis_client.ping()
        await redis_client.close()
        status_response["redis"]["status"] = "healthy"
    except Exception as e:
        status_response["redis"]["status"] = f"error: {str(e)}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://{settings.minio_endpoint}/minio/health/live",
                timeout=5.0
            )
            if response.status_code == 200:
                status_response["minio"]["status"] = "healthy"
            else:
                status_response["minio"]["status"] = "unhealthy"
    except Exception as e:
        status_response["minio"]["status"] = f"error: {str(e)}"

    overall_healthy = all(
        s.get("status") == "healthy"
        for key, s in status_response.items()
        if key not in ["embeddings", "reranker"]
    )

    return {
        "overall": "healthy" if overall_healthy else "degraded",
        **status_response,
    }
