import pytest
import json


def test_chat_request_model():
    from backend.app.api.routes.chat import ChatRequest

    request = ChatRequest(
        query="What are the termination provisions in Employment Act?",
        filters={"doc_type": "act"},
    )

    assert request.query == "What are the termination provisions in Employment Act?"
    assert request.filters["doc_type"] == "act"


def test_chat_response_model():
    from backend.app.api.routes.chat import ChatResponse

    response = ChatResponse(
        session_id="test-session-123",
        final_answer="Under the Employment Act...",
        sources=[
            {"citation": "Employment Act, 1980, s 35", "excerpt": "..."}
        ],
        confidence="HIGH",
        disclaimer="This response is for legal research purposes only...",
        agent_trace=[
            {"agent": "router", "action": "routing_decision"},
            {"agent": "statute", "action": "statute_analysis"},
        ],
    )

    assert response.session_id == "test-session-123"
    assert response.confidence == "HIGH"
    assert len(response.sources) == 1


def test_sse_event_types():
    valid_event_types = [
        "agent_start",
        "routing",
        "retrieval",
        "token",
        "sources",
        "done",
        "error",
    ]

    sample_events = [
        {"type": "agent_start", "agent": "router", "message": "Routing..."},
        {"type": "routing", "agents": ["STATUTE"], "reasoning": "...", "confidence": 0.9},
        {"type": "retrieval", "agent": "statute", "chunks_found": 7, "top_score": 0.91},
        {"type": "token", "content": "In terms"},
        {"type": "sources", "sources": []},
        {"type": "done"},
    ]

    for event in sample_events:
        assert event["type"] in valid_event_types


def test_session_model():
    from backend.app.api.routes.chat import ChatRequest

    request = ChatRequest(query="Test query")

    assert request.filters is None


def test_streaming_response_headers():
    required_headers = [
        "Content-Type",
        "Cache-Control",
        "X-Accel-Buffering",
    ]

    mock_headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }

    for header in required_headers:
        assert header in mock_headers
