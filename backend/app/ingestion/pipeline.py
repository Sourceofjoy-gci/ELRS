import uuid
import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from minio import Minio
from app.core.config import get_settings
from app.retrieval.embedder import get_embedder
from app.ingestion.chunker import EswatiniLegalChunker
from app.ingestion.connectors.pdf_connector import extract_pdf_text
from app.ingestion.connectors.docx_connector import extract_docx_text

logger = logging.getLogger(__name__)
settings = get_settings()


class IngestionPipeline:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedder = get_embedder()
        self.chunker = EswatiniLegalChunker()
        self.minio_client = None

    def _get_minio_client(self) -> Minio:
        if self.minio_client is None:
            self.minio_client = Minio(
                settings.minio_endpoint,
                access_key=settings.minio_root_user,
                secret_key=settings.minio_root_password,
                secure=False,
            )
        return self.minio_client

    async def run(self, document_id: str) -> bool:
        from app.core.models import LegalDocument, DocumentChunk, IngestionJob

        logger.info(f"Starting ingestion pipeline for document {document_id}")

        job_query = select(IngestionJob).where(IngestionJob.document_id == uuid.UUID(document_id))
        result = await self.db.execute(job_query)
        job = result.scalar_one_or_none()

        if not job:
            job = IngestionJob(
                document_id=uuid.UUID(document_id),
                status="pending",
            )
            self.db.add(job)
            await self.db.commit()
            await self.db.refresh(job)

        try:
            job.status = "processing"
            job.started_at = datetime.utcnow()
            await self.db.commit()

            doc_query = select(LegalDocument).where(LegalDocument.id == uuid.UUID(document_id))
            result = await self.db.execute(doc_query)
            document = result.scalar_one_or_none()

            if not document:
                raise ValueError(f"Document {document_id} not found")

            if document.raw_text:
                text = document.raw_text
            elif document.file_path:
                text = await self._download_and_extract(document.file_path)
                document.raw_text = text
            else:
                raise ValueError(f"No content available for document {document_id}")

            document_metadata = {
                "title": document.title,
                "act_number": document.act_number,
                "year": document.year,
                "doc_type": document.doc_type,
            }

            chunks = self.chunker.chunk(text, document_metadata)

            for chunk in chunks:
                chunk.metadata["document_id"] = document_id

            embeddings = await self.embedder.embed_documents([c.content for c in chunks])

            for chunk, embedding in zip(chunks, embeddings):
                db_chunk = DocumentChunk(
                    document_id=uuid.UUID(document_id),
                    chunk_index=chunk.metadata.get("chunk_index", 0),
                    content=chunk.content,
                    section_number=chunk.section_number,
                    section_heading=chunk.section_heading,
                    part_heading=chunk.part_heading,
                    chapter_heading=chunk.chapter_heading,
                    token_count=chunk.token_count,
                    embedding=embedding,
                    metadata=chunk.metadata,
                )
                self.db.add(db_chunk)

            job.status = "done"
            job.chunks_created = len(chunks)
            job.completed_at = datetime.utcnow()
            await self.db.commit()

            logger.info(f"Successfully ingested document {document_id} with {len(chunks)} chunks")
            return True

        except Exception as e:
            logger.error(f"Error ingesting document {document_id}: {e}")
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await self.db.commit()
            return False

    async def _download_and_extract(self, file_path: str) -> str:
        minio_client = self._get_minio_client()
        bucket_name = settings.minio_bucket

        try:
            minio_client.fget_object(bucket_name, file_path, "/tmp/temp_doc")
        except Exception as e:
            logger.warning(f"Could not download from MinIO: {e}")
            return ""

        if file_path.endswith(".pdf"):
            return extract_pdf_text("/tmp/temp_doc")
        elif file_path.endswith(".docx"):
            return extract_docx_text("/tmp/temp_doc")
        elif file_path.endswith(".txt"):
            with open("/tmp/temp_doc", "r", encoding="utf-8") as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file type: {file_path}")


async def ingest_document(document_id: str, db: AsyncSession) -> bool:
    pipeline = IngestionPipeline(db)
    return await pipeline.run(document_id)
