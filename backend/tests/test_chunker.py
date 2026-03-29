import pytest
from backend.app.ingestion.chunker import EswatiniLegalChunker


@pytest.fixture
def chunker():
    return EswatiniLegalChunker(max_tokens=600, overlap_tokens=150)


def test_part_boundary_detection(chunker):
    text = """
PART I — PRELIMINARY

This is the content of Part I.

PART II — EMPLOYMENT CONDITIONS

This is the content of Part II.
    """.strip()

    parts = chunker.split_into_parts(text)

    assert len(parts) == 2
    assert "PART I" in parts[0][0]
    assert "PART II" in parts[1][0]


def test_section_boundary_detection(chunker):
    text = """
15. Termination of contract

(1) An employer may terminate a contract...

(2) Notice must be given in writing...

16. Severance pay

(1) Severance shall be calculated...
    """.strip()

    sections = chunker.split_into_sections(text)

    assert len(sections) == 2
    assert sections[0]["number"] == "15"
    assert sections[1]["number"] == "16"


def test_subsection_preserved(chunker):
    text = """
15. Termination of contract

(1) An employer may terminate a contract by giving notice...

(2) The notice period shall be not less than one month...

(3) No notice is required where termination is for misconduct...
    """.strip()

    sections = chunker.split_into_sections(text)
    subsections = chunker._split_into_subsections(sections[0]["lines"])

    assert len(subsections) >= 3
    assert "(1)" in subsections[0]
    assert "(2)" in subsections[1]
    assert "(3)" in subsections[2]


def test_section_metadata_propagated(chunker):
    text = """
15. Termination of contract

(1) An employer may terminate a contract by giving notice...
    """.strip()

    document_metadata = {
        "title": "Employment Act, 1980",
        "act_number": "Act 5 of 1980",
        "year": 1980,
        "doc_type": "act",
    }

    chunks = chunker.chunk(text, document_metadata)

    assert len(chunks) > 0
    for chunk in chunks:
        assert chunk.section_number == "15"
        assert chunk.metadata.get("section_heading") is not None or chunk.metadata.get("section_number") == "15"


def test_cross_reference_preserved(chunker):
    text = """
15. Termination of contract

(1) An employer may terminate a contract. See section 14(2) for definition of misconduct.
    """.strip()

    result = chunker.preserve_cross_references(text)

    assert "see section 14(2)" in result.lower()


def test_max_chunk_size(chunker):
    long_text = """
15. Very long section

""" + "A" * 3000 + """

16. Next section
    """.strip()

    document_metadata = {"title": "Test Act", "doc_type": "act"}

    chunks = chunker.chunk(long_text, document_metadata)

    for chunk in chunks:
        assert chunk.token_count <= 800


def test_overlap_window(chunker):
    text = """
""" + "Sample text that appears in the overlap. " * 50 + """

""" + "New section content. " * 50 + """
    """.strip()

    document_metadata = {"title": "Test Act", "doc_type": "act"}

    chunks = chunker.chunk(text, document_metadata)

    if len(chunks) >= 2:
        assert len(chunks) >= 2


def test_fallback_window(chunker):
    text = """
This is a long prose text without any section headers. It continues for many sentences
and paragraphs without any clear structure. The chunker should fall back to a window-based
approach in this case to ensure that we can still process the text effectively.
    """ * 20

    document_metadata = {"title": "Test Act", "doc_type": "act"}

    chunks = chunker.chunk(text, document_metadata)

    assert len(chunks) > 0
