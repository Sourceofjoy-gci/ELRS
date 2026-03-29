import pytest
from app.agents.citation_normalizer import (
    normalize_statute_citation,
    normalize_constitutional_citation,
    normalize_case_law_citation,
    normalize_comparison_item,
    normalize_citations,
    LegalCitation,
)


def test_normalize_statute_citation():
    citation = {
        "act": "Employment Act",
        "year": 1980,
        "section": "35(1)(b)",
        "excerpt": "No employer shall terminate a contract of employment without...",
        "related_provisions": ["Employment Act s 36"],
    }
    result = normalize_statute_citation(citation)
    assert result["type"] == "statute"
    assert result["identifier"] == "Employment Act, 1980, s 35(1)(b)"
    assert result["text"] == citation["excerpt"]
    assert result["metadata"]["act"] == "Employment Act"
    assert result["metadata"]["related_provisions"] == ["Employment Act s 36"]


def test_normalize_constitutional_citation():
    citation = {
        "chapter": "3",
        "section": "21",
        "right": "Right to fair trial",
        "excerpt": "Every person has the right to a fair trial...",
        "related_constitutional_provisions": ["Constitution s 22"],
    }
    result = normalize_constitutional_citation(citation)
    assert result["type"] == "constitutional"
    assert "s 21" in result["identifier"]
    assert result["text"] == citation["excerpt"]
    assert result["metadata"]["right"] == "Right to fair trial"


def test_normalize_case_law_citation():
    citation = {
        "case_name": "Smith v Jones",
        "court": "High Court",
        "year": 2010,
        "citation": "Civ 123",
        "summary": "Wrongful dismissal established. Employer liable for damages...",
        "precedential_value": "HIGH",
    }
    result = normalize_case_law_citation(citation)
    assert result["type"] == "case_law"
    assert "Smith v Jones" in result["identifier"]
    assert result["text"] == citation["summary"]
    assert result["metadata"]["precedential_value"] == "HIGH"


def test_normalize_comparison_item():
    comparison = {
        "provision_1": "Employment Act, 1980, s 35",
        "provision_2": "Industrial Relations Act, 2000, s 12",
        "relationship": "conflicting",
        "analysis": "The two provisions conflict on the definition of strike action...",
    }
    result = normalize_comparison_item(comparison)
    assert len(result) == 2
    assert result[0]["type"] == "comparison"
    assert result[0]["identifier"] == "Employment Act, 1980, s 35"
    assert result[1]["identifier"] == "Industrial Relations Act, 2000, s 12"
    assert result[0]["metadata"]["relationship"] == "conflicting"


def test_normalize_citations_full_pipeline():
    """All four agent outputs normalize to LegalCitation[]"""
    agent_outputs = {
        "statute_result": {
            "citations": [
                {"act": "Employment Act", "year": 1980, "section": "35", "excerpt": "No employer shall..."}
            ]
        },
        "constitutional_result": {
            "citations": [
                {"chapter": "3", "section": "21", "right": "Fair trial", "excerpt": "Every person has the right..."}
            ]
        },
        "case_law_result": {
            "citations": [
                {"case_name": "Smith v Jones", "court": "HC", "year": 2010, "citation": "123", "summary": "Wrongful dismissal..."}
            ]
        },
        "comparison_result": {
            "comparisons": [
                {"provision_1": "EA s 35", "provision_2": "IRA s 12", "relationship": "complementary", "analysis": "Both support..."}
            ]
        },
    }
    result = normalize_citations(agent_outputs)
    # 1 statute + 1 constitutional + 1 case_law + 2 from comparison = 5
    assert len(result) == 5
    types = [c["type"] for c in result]
    assert "statute" in types
    assert "constitutional" in types
    assert "case_law" in types
    assert types.count("comparison") == 2


def test_normalize_citations_partial_inputs():
    """normalize_citations handles missing agent results gracefully."""
    agent_outputs = {
        "statute_result": {
            "citations": [
                {"act": "Employment Act", "year": 1980, "section": "35", "excerpt": "No employer shall..."}
            ]
        },
        # constitutional_result, case_law_result, comparison_result all missing
    }
    result = normalize_citations(agent_outputs)
    assert len(result) == 1
    assert result[0]["type"] == "statute"


def test_normalize_citations_empty():
    """normalize_citations returns empty list when no results."""
    result = normalize_citations({})
    assert result == []