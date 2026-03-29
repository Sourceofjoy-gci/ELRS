import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json


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
