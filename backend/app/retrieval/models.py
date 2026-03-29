from dataclasses import dataclass, field
from typing import Optional, Dict, Any


@dataclass
class RetrievedChunk:
    id: str
    content: str
    document_id: str
    act_name: str
    act_number: Optional[str] = None
    year: Optional[int] = None
    doc_type: str = "act"
    section_number: Optional[str] = None
    section_heading: Optional[str] = None
    part_heading: Optional[str] = None
    vector_score: Optional[float] = None
    bm25_score: Optional[float] = None
    rrf_score: Optional[float] = None
    reranker_score: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "document_id": self.document_id,
            "act_name": self.act_name,
            "act_number": self.act_number,
            "year": self.year,
            "doc_type": self.doc_type,
            "section_number": self.section_number,
            "section_heading": self.section_heading,
            "part_heading": self.part_heading,
            "vector_score": self.vector_score,
            "bm25_score": self.bm25_score,
            "rrf_score": self.rrf_score,
            "reranker_score": self.reranker_score,
            "metadata": self.metadata,
        }

    @classmethod
    def from_db_row(cls, row: Any) -> "RetrievedChunk":
        metadata = row.get("metadata", {}) if isinstance(row, dict) else getattr(row, "metadata", {})
        return cls(
            id=str(row.get("id")),
            content=row.get("content", ""),
            document_id=str(row.get("document_id")),
            act_name=row.get("act_name", ""),
            act_number=row.get("act_number"),
            year=row.get("year"),
            doc_type=row.get("doc_type", "act"),
            section_number=row.get("section_number"),
            section_heading=row.get("section_heading"),
            part_heading=row.get("part_heading"),
            vector_score=row.get("vector_score"),
            bm25_score=row.get("bm25_score"),
            metadata=metadata,
        )
