"""
Tests for text_extractor.py — error-wrapping behavior.
Run: pytest backend/tests/test_text_extractor.py -v
"""
import pytest
import sys
import io
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from text_extractor import (
    extract_text,
    extract_text_from_docx,
    extract_text_from_pdf,
    EXTRACTION_ERROR,
)


class TestExtractText:
    def test_txt_utf8(self):
        text = extract_text(b"Hello world this is a test.", "document.txt")
        assert text == "Hello world this is a test."
        assert EXTRACTION_ERROR not in text

    def test_txt_latin1_fallback(self):
        # Latin-1 byte that can't be UTF-8
        text = extract_text(b"Hello \xb0 world", "document.txt")
        assert EXTRACTION_ERROR not in text

    def test_txt_utf8_then_latin1_fallback(self):
        # UTF-8 fails, but latin-1 always succeeds (1-to-1 byte mapping)
        # so invalid bytes that fail UTF-8 still decode via latin-1
        # This tests that the latin-1 fallback path works correctly
        invalid_bytes = b'\x80\x90\xff'  # Valid latin-1, invalid UTF-8
        text = extract_text(invalid_bytes, "document.txt")
        # latin-1 fallback should succeed and return decoded text
        assert text != EXTRACTION_ERROR
        assert len(text) > 0

    def test_docx_wrong_magic_bytes(self):
        text = extract_text(b"This is not a docx file.", "document.docx")
        assert text == EXTRACTION_ERROR

    def test_pdf_wrong_magic_bytes(self):
        text = extract_text(b"This is not a PDF file.", "document.pdf")
        assert text == EXTRACTION_ERROR

    def test_unsupported_extension(self):
        text = extract_text(b"some data", "document.xlsx")
        assert text == EXTRACTION_ERROR

    def test_empty_bytes_txt(self):
        text = extract_text(b"", "document.txt")
        assert text == ""


class TestExtractTextFromDocx:
    def test_invalid_docx(self):
        with pytest.raises(Exception):
            extract_text_from_docx(b"not a docx")


class TestExtractTextFromPdf:
    def test_invalid_pdf(self):
        with pytest.raises(Exception):
            extract_text_from_pdf(b"not a pdf")


class TestErrorSentinel:
    def test_extraction_error_is_string(self):
        assert isinstance(EXTRACTION_ERROR, str)
        assert EXTRACTION_ERROR == "[EXTRACTION_ERROR] Could not parse document"
