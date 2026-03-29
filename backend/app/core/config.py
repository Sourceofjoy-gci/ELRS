import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:changeme@postgres:5432/eswatini_legal"
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    minio_root_user: str = os.getenv("MINIO_ROOT_USER", "minio_admin")
    minio_root_password: str = os.getenv("MINIO_ROOT_PASSWORD", "changeme")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "legal-documents")

    jwt_secret: str = os.getenv("JWT_SECRET", "changeme_secret_key_32_chars_long")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    ollama_primary_model: str = os.getenv("OLLAMA_PRIMARY_MODEL", "mistral:7b-instruct-q4_K_M")
    ollama_fallback_model: str = os.getenv("OLLAMA_FALLBACK_MODEL", "llama3.1:8b-instruct-q4_K_M")
    ollama_router_model: str = os.getenv("OLLAMA_ROUTER_MODEL", "phi3:mini-instruct-q4")
    ollama_temperature: float = float(os.getenv("OLLAMA_TEMPERATURE", "0.1"))
    ollama_num_ctx: int = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
    ollama_request_timeout: float = float(os.getenv("OLLAMA_REQUEST_TIMEOUT", "300.0"))

    tei_embeddings_url: str = os.getenv("TEI_EMBEDDINGS_URL", "http://tei-embeddings:8080")
    tei_reranker_url: str = os.getenv("TEI_RERANKER_URL", "http://tei-reranker:8081")
    tei_embedding_dimensions: int = int(os.getenv("TEI_EMBEDDING_DIMENSIONS", "768"))
    tei_batch_size: int = int(os.getenv("TEI_BATCH_SIZE", "32"))

    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "8"))
    retrieval_rrf_k: int = int(os.getenv("RETRIEVAL_RRF_K", "60"))
    retrieval_min_vector_score: float = float(os.getenv("RETRIEVAL_MIN_VECTOR_SCORE", "0.55"))
    retrieval_reranker_candidates: int = int(os.getenv("RETRIEVAL_RERANKER_CANDIDATES", "30"))

    public_role_daily_limit: int = int(os.getenv("PUBLIC_ROLE_DAILY_LIMIT", "10"))

    langfuse_host: str = os.getenv("LANGFUSE_HOST", "http://langfuse:3000")
    langfuse_public_key: str = os.getenv("LANGFUSE_PUBLIC_KEY", "pk-lf-local-xxxx")
    langfuse_secret_key: str = os.getenv("LANGFUSE_SECRET_KEY", "sk-lf-local-xxxx")

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
