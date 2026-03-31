"""
Text extraction from uploaded files.
Handles docx, PDF, and plain text.
Wraps all parsers in error handling — never raises.
"""

import io
from typing import Optional

EXTRACTION_ERROR = "[EXTRACTION_ERROR] Could not parse document"


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from a .docx file. Raises on failure."""
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file. Raises on failure."""
    from PyPDF2 import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Extract text from a file based on its extension/mime type.
    Returns the text, or EXTRACTION_ERROR on any failure.

    Supported: .docx, .pdf, .txt
    """
    ext = filename.lower().split(".")[-1]

    if ext == "txt":
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1")
            except Exception:
                return EXTRACTION_ERROR

    if ext == "docx":
        try:
            return extract_text_from_docx(file_bytes)
        except Exception:
            return EXTRACTION_ERROR

    if ext == "pdf":
        try:
            return extract_text_from_pdf(file_bytes)
        except Exception:
            return EXTRACTION_ERROR

    return EXTRACTION_ERROR
