from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.retrieval.hybrid_retriever import HybridRetriever
from app.retrieval.models import RetrievedChunk

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    top_k: int = 8
    filters: Optional[Dict[str, Any]] = None


class SearchResponse(BaseModel):
    query: str
    chunks: list
    total: int


@router.post("", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    retriever = HybridRetriever(db)

    chunks = await retriever.retrieve(
        query=request.query,
        top_k=request.top_k,
        filters=request.filters,
    )

    return SearchResponse(
        query=request.query,
        chunks=[chunk.to_dict() for chunk in chunks],
        total=len(chunks),
    )


@router.get("")
async def search_get(
    q: str = Query(..., description="Search query"),
    top_k: int = Query(8, ge=1, le=50),
    doc_type: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    ministry: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filters = {}
    if doc_type:
        filters["doc_type"] = doc_type
    if year_min:
        filters["year_min"] = year_min
    if year_max:
        filters["year_max"] = year_max
    if status_filter:
        filters["status"] = status_filter
    if ministry:
        filters["ministry"] = ministry

    retriever = HybridRetriever(db)

    chunks = await retriever.retrieve(
        query=q,
        top_k=top_k,
        filters=filters,
    )

    return SearchResponse(
        query=q,
        chunks=[chunk.to_dict() for chunk in chunks],
        total=len(chunks),
    )
