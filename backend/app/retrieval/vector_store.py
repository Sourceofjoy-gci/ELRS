from typing import List, Optional, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.retrieval.models import RetrievedChunk

settings = get_settings()


class VectorStore:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def similarity_search(
        self,
        query_embedding: List[float],
        top_k: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        min_score: float = None,
    ) -> List[RetrievedChunk]:
        if min_score is None:
            min_score = settings.retrieval_min_vector_score

        filter_conditions = []
        params: Dict[str, Any] = {"embedding": query_embedding, "top_k": top_k, "min_score": min_score}

        if filters:
            if filters.get("doc_type"):
                filter_conditions.append("ld.doc_type = :doc_type")
                params["doc_type"] = filters["doc_type"]
            if filters.get("year_min"):
                filter_conditions.append("ld.year >= :year_min")
                params["year_min"] = filters["year_min"]
            if filters.get("year_max"):
                filter_conditions.append("ld.year <= :year_max")
                params["year_max"] = filters["year_max"]
            if filters.get("status"):
                filter_conditions.append("ld.status = :status")
                params["status"] = filters["status"]
            if filters.get("ministry"):
                filter_conditions.append("ld.ministry = :ministry")
                params["ministry"] = filters["ministry"]
            if filters.get("document_id"):
                filter_conditions.append("dc.document_id = :document_id")
                params["document_id"] = filters["document_id"]

        where_clause = " AND ".join(filter_conditions) if filter_conditions else "1=1"

        query = text(f"""
            SELECT
                dc.id,
                dc.content,
                dc.document_id,
                ld.title as act_name,
                ld.act_number,
                ld.year,
                ld.doc_type,
                dc.section_number,
                dc.section_heading,
                dc.part_heading,
                dc.metadata,
                1 - (dc.embedding <=> :embedding) AS vector_score
            FROM document_chunks dc
            JOIN legal_documents ld ON ld.id = dc.document_id
            WHERE {where_clause}
                AND dc.embedding IS NOT NULL
                AND 1 - (dc.embedding <=> :embedding) >= :min_score
            ORDER BY dc.embedding <=> :embedding
            LIMIT :top_k
        """)

        result = await self.db.execute(query, params)
        rows = result.fetchall()

        chunks = []
        for row in rows:
            chunk = RetrievedChunk(
                id=str(row.id),
                content=row.content,
                document_id=str(row.document_id),
                act_name=row.act_name,
                act_number=row.act_number,
                year=row.year,
                doc_type=row.doc_type,
                section_number=row.section_number,
                section_heading=row.section_heading,
                part_heading=row.part_heading,
                vector_score=float(row.vector_score) if row.vector_score else None,
                metadata=row.metadata or {},
            )
            chunks.append(chunk)

        return chunks
