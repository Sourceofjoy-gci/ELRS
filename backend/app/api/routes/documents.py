import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.models import LegalDocument, DocumentChunk, IngestionJob
from app.ingestion.pipeline import ingest_document

router = APIRouter()


class DocumentResponse(BaseModel):
    id: str
    title: str
    doc_type: str
    act_number: Optional[str]
    year: Optional[int]
    chapter: Optional[str]
    ministry: Optional[str]
    status: str
    commencement_date: Optional[str]
    source_url: Optional[str]
    metadata: dict
    chunks_count: int
    created_at: str

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list
    total: int
    page: int
    page_size: int


class IngestRequest(BaseModel):
    document_id: str


class IngestResponse(BaseModel):
    job_id: str
    status: str
    message: str


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    doc_type: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    ministry: Optional[str] = None,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(LegalDocument)
    count_query = select(func.count(LegalDocument.id))

    if doc_type:
        query = query.where(LegalDocument.doc_type == doc_type)
        count_query = count_query.where(LegalDocument.doc_type == doc_type)
    if year_min:
        query = query.where(LegalDocument.year >= year_min)
        count_query = count_query.where(LegalDocument.year >= year_min)
    if year_max:
        query = query.where(LegalDocument.year <= year_max)
        count_query = count_query.where(LegalDocument.year <= year_max)
    if status_filter:
        query = query.where(LegalDocument.status == status_filter)
        count_query = count_query.where(LegalDocument.status == status_filter)
    if ministry:
        query = query.where(LegalDocument.ministry == ministry)
        count_query = count_query.where(LegalDocument.ministry == ministry)
    if q:
        query = query.where(LegalDocument.title.ilike(f"%{q}%"))
        count_query = count_query.where(LegalDocument.title.ilike(f"%{q}%"))

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    query = query.order_by(LegalDocument.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    doc_responses = []
    for doc in documents:
        chunks_query = select(func.count(DocumentChunk.id)).where(
            DocumentChunk.document_id == doc.id
        )
        chunks_result = await db.execute(chunks_query)
        chunks_count = chunks_result.scalar() or 0

        doc_responses.append(DocumentResponse(
            id=str(doc.id),
            title=doc.title,
            doc_type=doc.doc_type,
            act_number=doc.act_number,
            year=doc.year,
            chapter=doc.chapter,
            ministry=doc.ministry,
            status=doc.status,
            commencement_date=doc.commencement_date.isoformat() if doc.commencement_date else None,
            source_url=doc.source_url,
            metadata=doc.metadata or {},
            chunks_count=chunks_count,
            created_at=doc.created_at.isoformat(),
        ))

    return DocumentListResponse(
        documents=doc_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(LegalDocument).where(LegalDocument.id == uuid.UUID(document_id))
    result = await db.execute(query)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_query = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id == uuid.UUID(document_id))
        .order_by(DocumentChunk.chunk_index)
    )
    chunks_result = await db.execute(chunks_query)
    chunks = chunks_result.scalars().all()

    return {
        "id": str(document.id),
        "title": document.title,
        "doc_type": document.doc_type,
        "act_number": document.act_number,
        "year": document.year,
        "chapter": document.chapter,
        "ministry": document.ministry,
        "status": document.status,
        "commencement_date": document.commencement_date.isoformat() if document.commencement_date else None,
        "source_url": document.source_url,
        "metadata": document.metadata or {},
        "created_at": document.created_at.isoformat(),
        "chunks": [
            {
                "id": str(c.id),
                "chunk_index": c.chunk_index,
                "content": c.content,
                "section_number": c.section_number,
                "section_heading": c.section_heading,
                "part_heading": c.part_heading,
                "token_count": c.token_count,
                "metadata": c.metadata or {},
            }
            for c in chunks
        ],
    }


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    request: IngestRequest,
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    doc_query = select(LegalDocument).where(
        LegalDocument.id == uuid.UUID(request.document_id)
    )
    doc_result = await db.execute(doc_query)
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    job = IngestionJob(
        document_id=uuid.UUID(request.document_id),
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    success = await ingest_document(request.document_id, db)

    if success:
        return IngestResponse(
            job_id=str(job.id),
            status="completed",
            message="Document ingestion completed successfully",
        )
    else:
        return IngestResponse(
            job_id=str(job.id),
            status="failed",
            message="Document ingestion failed. Check job status for details.",
        )


@router.get("/ingest/jobs")
async def list_ingestion_jobs(
    current_user: dict = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(IngestionJob)
        .order_by(IngestionJob.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    jobs = result.scalars().all()

    return [
        {
            "id": str(job.id),
            "document_id": str(job.document_id) if job.document_id else None,
            "status": job.status,
            "error_message": job.error_message,
            "chunks_created": job.chunks_created,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "created_at": job.created_at.isoformat(),
        }
        for job in jobs
    ]


@router.get("/metadata/ministries")
async def get_ministries(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(func.distinct(LegalDocument.ministry)).where(
        LegalDocument.ministry.isnot(None)
    )
    result = await db.execute(query)
    ministries = [m[0] for m in result.fetchall() if m[0]]

    return {"ministries": ministries}


@router.get("/metadata/doc-types")
async def get_doc_types(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(func.distinct(LegalDocument.doc_type))
    result = await db.execute(query)
    doc_types = [dt[0] for dt in result.fetchall() if dt[0]]

    return {"doc_types": doc_types}
