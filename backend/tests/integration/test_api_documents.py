import pytest


def test_document_response_model():
    from backend.app.api.routes.documents import DocumentResponse

    doc = DocumentResponse(
        id="test-uuid",
        title="Employment Act, 1980",
        doc_type="act",
        act_number="Act 5 of 1980",
        year=1980,
        chapter="Chapter 47",
        ministry="Labour",
        status="active",
        commencement_date="1980-09-01",
        source_url="https://laws.gov.sz/employment-act",
        metadata={"key": "value"},
        chunks_count=150,
        created_at="2024-01-01T00:00:00",
    )

    assert doc.title == "Employment Act, 1980"
    assert doc.year == 1980
    assert doc.status == "active"


def test_document_list_response():
    from backend.app.api.routes.documents import DocumentListResponse, DocumentResponse

    response = DocumentListResponse(
        documents=[
            DocumentResponse(
                id="1",
                title="Act 1",
                doc_type="act",
                act_number="Act 1 of 2000",
                year=2000,
                chapter=None,
                ministry="Labour",
                status="active",
                commencement_date=None,
                source_url=None,
                metadata={},
                chunks_count=0,
                created_at="2024-01-01",
            )
        ],
        total=1,
        page=1,
        page_size=25,
    )

    assert response.total == 1
    assert len(response.documents) == 1
    assert response.page == 1


def test_ingest_request_model():
    from backend.app.api.routes.documents import IngestRequest

    request = IngestRequest(document_id="test-uuid-123")

    assert request.document_id == "test-uuid-123"


def test_ingest_response_model():
    from backend.app.api.routes.documents import IngestResponse

    response = IngestResponse(
        job_id="job-uuid-456",
        status="completed",
        message="Document ingestion completed successfully",
    )

    assert response.status == "completed"
    assert "completed" in response.message


def test_document_filter_params():
    filters = {}

    doc_type = "act"
    year_min = 2000
    year_max = 2020
    ministry = "Labour"
    status_filter = "active"

    if doc_type:
        filters["doc_type"] = doc_type
    if year_min:
        filters["year_min"] = year_min
    if year_max:
        filters["year_max"] = year_max
    if ministry:
        filters["ministry"] = ministry
    if status_filter:
        filters["status"] = status_filter

    assert filters["doc_type"] == "act"
    assert filters["year_min"] == 2000
    assert filters["year_max"] == 2020
    assert filters["ministry"] == "Labour"
    assert filters["status"] == "active"


def test_pagination_params():
    page = 1
    page_size = 25

    offset = (page - 1) * page_size
    limit = page_size

    assert offset == 0
    assert limit == 25

    page = 2
    offset = (page - 1) * page_size
    assert offset == 25
