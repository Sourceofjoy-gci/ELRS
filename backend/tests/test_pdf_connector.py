import pytest
import os
from backend.app.ingestion.connectors.pdf_connector import PDFConnector


@pytest.fixture
def connector():
    return PDFConnector()


def test_normalises_whitespace(connector):
    text = "  Hello    World  \n\n  Test   "
    result = connector._normalize_whitespace(text)
    assert result == "Hello World Test"
    assert "  " not in result


def test_normalises_legal_numbering(connector):
    text = "Section 15 (1) This is a subsection"
    result = connector._normalize_legal_numbering(text)
    assert "15(1)" in result or "15 (1)" in result


def test_page_number_pattern():
    import re
    pattern = PDFConnector.PAGE_NUMBER_PATTERN

    assert pattern.match("Page 1 of 50")
    assert pattern.match("- 25 -")
    assert pattern.match("5 / 50")
    assert not pattern.match("This is not a page number")
    assert not pattern.match("Page 1 of 50 This is content")
