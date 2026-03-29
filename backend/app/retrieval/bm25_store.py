from typing import List, Optional, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.retrieval.models import RetrievedChunk


class BM25Store:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _build_tsquery(self, query: str) -> str:
        words = query.split()
        ts_query_parts = []
        for word in words:
            clean_word = ''.join(c for c in word if c.isalnum())
            if clean_word:
                ts_query_parts.append(f"{clean_word}:*")
        return ' & '.join(ts_query_parts) if ts_query_parts else query

    async def keyword_search(
        self,
        query: str,
        top_k: int = 20,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        filter_conditions = []
        params: Dict[str, Any] = {"query": query, "top_k": top_k}

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

        where_clause = " AND ".join(filter_conditions) if filter_conditions else "1=1"

        content_query = text(f"""
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
                ts_rank(to_tsvector('english', dc.content), to_tsquery('english', :ts_query)) AS bm25_score
            FROM document_chunks dc
            JOIN legal_documents ld ON ld.id = dc.document_id
            WHERE to_tsvector('english', dc.content) @@ to_tsquery('english', :ts_query)
                AND {where_clause}
            ORDER BY bm25_score DESC
            LIMIT :top_k
        """)

        ts_query = self._build_tsquery(query)
        params["ts_query"] = ts_query

        result = await self.db.execute(content_query, params)
        content_rows = result.fetchall()

        chunks_dict: Dict[str, RetrievedChunk] = {}
        for row in content_rows:
            chunk_id = str(row.id)
            if chunk_id not in chunks_dict:
                chunk = RetrievedChunk(
                    id=chunk_id,
                    content=row.content,
                    document_id=str(row.document_id),
                    act_name=row.act_name,
                    act_number=row.act_number,
                    year=row.year,
                    doc_type=row.doc_type,
                    section_number=row.section_number,
                    section_heading=row.section_heading,
                    part_heading=row.part_heading,
                    bm25_score=float(row.bm25_score) if row.bm25_score else None,
                    metadata=row.metadata or {},
                )
                chunks_dict[chunk_id] = chunk

        heading_query = text(f"""
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
                ts_rank(to_tsvector('english', dc.section_heading), to_tsquery('english', :ts_query)) AS bm25_score
            FROM document_chunks dc
            JOIN legal_documents ld ON ld.id = dc.document_id
            WHERE dc.section_heading IS NOT NULL
                AND to_tsvector('english', dc.section_heading) @@ to_tsquery('english', :ts_query)
                AND {where_clause}
            ORDER BY bm25_score DESC
            LIMIT :top_k
        """)

        heading_result = await self.db.execute(heading_query, params)
        heading_rows = heading_result.fetchall()

        for row in heading_rows:
            chunk_id = str(row.id)
            if chunk_id not in chunks_dict:
                chunk = RetrievedChunk(
                    id=chunk_id,
                    content=row.content,
                    document_id=str(row.document_id),
                    act_name=row.act_name,
                    act_number=row.act_number,
                    year=row.year,
                    doc_type=row.doc_type,
                    section_number=row.section_number,
                    section_heading=row.section_heading,
                    part_heading=row.part_heading,
                    bm25_score=float(row.bm25_score) if row.bm25_score else None,
                    metadata=row.metadata or {},
                )
                chunks_dict[chunk_id] = chunk

        return list(chunks_dict.values())
