import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.routes import auth, chat, search, documents, health, models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ELRI Backend...")
    yield
    logger.info("Shutting down ELRI Backend...")


app = FastAPI(
    title="ELRI - Eswatini Legal Research Intelligence",
    description="Production-ready, fully air-gapped, multi-agent AI legal research platform for the Kingdom of Eswatini",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(health.router, prefix="/api/v1/health", tags=["Health"])
app.include_router(models.router, prefix="/api/v1/models", tags=["Models"])


@app.get("/")
async def root():
    return {
        "name": "ELRI - Eswatini Legal Research Intelligence",
        "version": "1.0.0",
        "status": "operational",
        "Siyinqaba": "We are the fortress.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
