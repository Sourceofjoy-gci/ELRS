import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json
from app.agents.graph import create_legal_research_graph, LegalResearchState


@pytest.fixture
def mock_ollama_response():
    """Return a mock Ollama chat response wrapping JSON content."""
    def make_response(content: str):
        return {"message": {"content": content}}
    return make_response


@pytest.fixture
def mock_db():
    """Dummy async DB session mock."""
    return AsyncMock()


def test_routing_decision_structure():
    routing = {
        "agents": ["STATUTE", "CONSTITUTIONAL"],
        "reasoning": "Query about constitutional rights to fair trial in employment context",
        "confidence": 0.92,
        "query_type": "constitutional_interpretation",
    }

    assert "agents" in routing
    assert "reasoning" in routing
    assert "confidence" in routing
    assert "query_type" in routing
    assert isinstance(routing["agents"], list)
    assert len(routing["agents"]) <= 3


def test_agent_result_structure():
    result = {
        "answer": "Detailed legal analysis...",
        "citations": [
            {
                "act": "Employment Act",
                "year": 1980,
                "section": "35",
                "excerpt": "An employer may terminate..."
            }
        ],
        "confidence": "HIGH",
        "caveats": "Based on available context",
        "related_provisions": ["Employment Act s 36"],
    }

    assert "answer" in result
    assert "citations" in result
    assert "confidence" in result
    assert result["confidence"] in ["HIGH", "MEDIUM", "LOW"]


def test_synthesis_result_structure():
    synthesis = {
        "direct_answer": "Under Eswatini law, constitutional rights apply...",
        "analysis": {
            "applicable_law": "Relevant provisions from Employment Act and Constitution",
            "detailed_analysis": "Analysis of how the provisions interact...",
            "conclusion": "Therefore, the employer's actions were...",
        },
        "references": [
            {
                "type": "act",
                "citation": "Employment Act, 1980, s 35(1)",
                "excerpt": "An employer may terminate..."
            }
        ],
        "related_legislation": ["Industrial Relations Act, 2000"],
        "confidence": "MEDIUM",
        "disclaimer": "This response is for legal research purposes only...",
    }

    assert "direct_answer" in synthesis
    assert "analysis" in synthesis
    assert "references" in synthesis
    assert "confidence" in synthesis
    assert "disclaimer" in synthesis


def test_agent_trace_structure():
    trace = [
        {
            "agent": "router",
            "action": "routing_decision",
            "latency_ms": 150,
            "model_used": "phi3:mini-instruct-q4",
        },
        {
            "agent": "statute",
            "action": "statute_analysis",
            "chunks_found": 8,
            "top_score": 0.87,
            "latency_ms": 5000,
            "model_used": "mistral:7b-instruct-q4_K_M",
        },
        {
            "agent": "synthesis",
            "action": "synthesis_generation",
            "latency_ms": 8000,
            "model_used": "llama3.1:8b-instruct-q4_K_M",
        },
    ]

    assert len(trace) == 3
    assert trace[0]["agent"] == "router"
    assert "latency_ms" in trace[0]
    assert "model_used" in trace[0]


def test_constitutional_query_routing():
    query = "What are the constitutional rights to fair trial in Eswatini?"
    query_lower = query.lower()

    is_constitutional = any(
        keyword in query_lower
        for keyword in ["constitutional", "constitution", "rights", "fair trial", "bill of rights"]
    )

    assert is_constitutional
    assert "fair trial" in query_lower


def test_statute_query_routing():
    query = "What does section 35 of the Employment Act say about termination?"

    is_statute = any(
        keyword in query.lower()
        for keyword in ["section", "employment act", "termination", "s 35"]
    )

    assert is_statute


def test_comparison_query_routing():
    query = "Compare termination provisions in Employment Act and Labour Act"

    is_comparison = "compare" in query.lower() and "and" in query.lower()

    assert is_comparison


@pytest.mark.asyncio
async def test_routes_to_statute_only(mock_ollama_response, mock_db):
    """Router returns STATUTE → statute_node runs, others skip."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["STATUTE"], "reasoning": "statutory query", "confidence": 0.9, "query_type": "statutory"}')

    initial_state: LegalResearchState = {
        "query": "What does section 35 of the Employment Act say?",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "subsidiary_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["STATUTE"]
    assert result["statute_result"] is not None
    assert result["constitutional_result"] is None
    assert result["case_law_result"] is None
    assert result["comparison_result"] is None


@pytest.mark.asyncio
async def test_routes_to_constitutional_only(mock_ollama_response, mock_db):
    """Router returns CONSTITUTIONAL → constitutional_node runs, others skip."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["CONSTITUTIONAL"], "reasoning": "constitutional query", "confidence": 0.9, "query_type": "constitutional"}')

    initial_state: LegalResearchState = {
        "query": "What are the constitutional rights to fair trial?",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["CONSTITUTIONAL"]
    assert result["statute_result"] is None
    assert result["constitutional_result"] is not None
    assert result["case_law_result"] is None
    assert result["comparison_result"] is None


@pytest.mark.asyncio
async def test_routes_to_case_law_only(mock_ollama_response, mock_db):
    """Router returns CASE_LAW → case_law_node runs, others skip."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["CASE_LAW"], "reasoning": "case law query", "confidence": 0.9, "query_type": "case_law"}')

    initial_state: LegalResearchState = {
        "query": "What precedents exist for wrongful dismissal?",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["CASE_LAW"]
    assert result["statute_result"] is None
    assert result["constitutional_result"] is None
    assert result["case_law_result"] is not None
    assert result["comparison_result"] is None


@pytest.mark.asyncio
async def test_routes_to_comparison_only(mock_ollama_response, mock_db):
    """Router returns COMPARISON → comparison_node runs, others skip."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["COMPARISON"], "reasoning": "comparison query", "confidence": 0.9, "query_type": "comparison"}')

    initial_state: LegalResearchState = {
        "query": "Compare termination provisions in Employment Act and Labour Act",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["COMPARISON"]
    assert result["statute_result"] is None
    assert result["constitutional_result"] is None
    assert result["case_law_result"] is None
    assert result["comparison_result"] is not None


@pytest.mark.asyncio
async def test_routes_to_multiple_agents(mock_ollama_response, mock_db):
    """Router returns [STATUTE, CONSTITUTIONAL] → both specialist nodes run."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["STATUTE", "CONSTITUTIONAL"], "reasoning": "multi-domain query", "confidence": 0.85, "query_type": "mixed"}')

    initial_state: LegalResearchState = {
        "query": "Does employment law comply with constitutional rights?",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["STATUTE", "CONSTITUTIONAL"]
    assert result["statute_result"] is not None
    assert result["constitutional_result"] is not None
    assert result["case_law_result"] is None
    assert result["comparison_result"] is None


@pytest.mark.asyncio
async def test_routes_to_subsidiary_only(mock_ollama_response, mock_db):
    """Router returns SUBSIDIARY → subsidiary_node runs, others skip."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["SUBSIDIARY"], "reasoning": "subsidiary legislation query", "confidence": 0.9, "query_type": "subsidiary"}')

    initial_state: LegalResearchState = {
        "query": "What do the SI 45 of 2000 regulations say about immigration?",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "subsidiary_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["SUBSIDIARY"]
    assert result["statute_result"] is None
    assert result["constitutional_result"] is None
    assert result["case_law_result"] is None
    assert result["comparison_result"] is None
    assert result.get("subsidiary_result") is not None


@pytest.mark.asyncio
async def test_routes_to_subsidiary_with_statute(mock_ollama_response, mock_db):
    """Router returns [STATUTE, SUBSIDIARY] → both specialist nodes run."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        return mock_ollama_response('{"agents": ["STATUTE", "SUBSIDIARY"], "reasoning": "query about statute and SI", "confidence": 0.85, "query_type": "mixed"}')

    initial_state: LegalResearchState = {
        "query": "How do the Employment Act provisions interact with SI 45 of 2000?",
        "user_id": "test-user-id",
        "filters": {},
        "routing_decision": {},
        "statute_result": None,
        "constitutional_result": None,
        "case_law_result": None,
        "comparison_result": None,
        "subsidiary_result": None,
        "retrieved_chunks": [],
        "agent_trace": [],
        "final_answer": "",
        "sources": [],
        "confidence": "MEDIUM",
        "disclaimer": "",
    }

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            result = await graph.ainvoke(initial_state, {"configurable": {"db": mock_db}})

    assert result["routing_decision"]["agents"] == ["STATUTE", "SUBSIDIARY"]
    assert result["statute_result"] is not None
    assert result.get("subsidiary_result") is not None
    assert result["constitutional_result"] is None
    assert result["case_law_result"] is None
    assert result["comparison_result"] is None
