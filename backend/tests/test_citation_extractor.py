"""
Tests for citation_extractor.py — pure functions, no Flask deps.
Run: pytest backend/tests/test_citation_extractor.py -v
"""
import pytest
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from citation_extractor import (
    extract_citations,
    verify_citation,
    verify_citations,
    normalize,
    normalize_citation_for_lookup,
)

CORPUS_DB = str(Path(__file__).parent.parent / "corpus.db")


class TestNormalize:
    def test_strips_whitespace(self):
        assert normalize("  hello   world  ") == "hello world"

    def test_lowercase(self):
        assert normalize("HELLO WORLD") == "hello world"

    def test_collapse_spaces(self):
        assert normalize("hello    world") == "hello world"

    def test_empty_string(self):
        assert normalize("") == ""


class TestNormalizeCitationForLookup:
    def test_removes_brackets(self):
        assert normalize_citation_for_lookup("[2015]") == "2015"
        assert normalize_citation_for_lookup("(SZHC 45/2018)") == "szhc 45/2018"

    def test_combined_with_normalize(self):
        result = normalize_citation_for_lookup("  [SZHC]  45/2018  ")
        assert "(" not in result
        assert ")" not in result
        assert "[" not in result


class TestExtractCitations:
    def test_extracts_case_citation_parenthetical(self):
        text = "R v Dlamini (SZHC 45/2018) is relevant."
        results = extract_citations(text)
        assert len(results) == 1
        assert results[0]["type"] == "case"
        assert results[0]["raw"] == "R v Dlamini (SZHC 45/2018)"

    def test_extracts_case_citation_bracket(self):
        text = "S v Nkosi [2015] HC 12 was decided in 2015."
        results = extract_citations(text)
        case_results = [r for r in results if r["type"] == "case"]
        assert len(case_results) >= 1

    def test_extracts_case_citation_versus(self):
        # Two-party case names where second party is a single word
        text = "Dlamini v Minister (SZHC 89/2019) is relevant."
        results = extract_citations(text)
        case_results = [r for r in results if r["type"] == "case"]
        assert len(case_results) >= 1

    def test_extracts_statute_section(self):
        text = "Section 105A of the CPA applies."
        results = extract_citations(text)
        statute_results = [r for r in results if r["type"] == "statute"]
        assert len(statute_results) >= 1

    def test_extracts_statute_shorthand(self):
        text = "s. 12 of the Constitution"
        results = extract_citations(text)
        statute_results = [r for r in results if r["type"] == "statute"]
        assert len(statute_results) >= 1

    def test_extracts_constitution_article(self):
        text = "Article 24 of the Constitution guarantees the right to life."
        results = extract_citations(text)
        const_results = [r for r in results if r["type"] == "constitution"]
        assert len(const_results) >= 1

    def test_extracts_multiple_citations(self):
        text = "R v Dlamini (SZHC 45/2018) and Section 105A CPA"
        results = extract_citations(text)
        assert len(results) >= 2

    def test_empty_text_returns_empty_list(self):
        assert extract_citations("") == []
        assert extract_citations("   ") == []
        assert extract_citations(None) == []

    def test_no_citations(self):
        text = "This is a document with no legal citations."
        results = extract_citations(text)
        assert results == []


class TestVerifyCitation:
    def test_valid_active_case(self):
        citation = {
            "raw": "R v Dlamini (SZHC 45/2018)",
            "type": "case",
            "case_name": "R v Dlamini",
            "court_abbr": "SZHC",
            "case_number": "45/2018",
            "normalized": "r v dlamini szhc 45/2018",
        }
        status, message = verify_citation(citation, CORPUS_DB)
        assert status == "VALID"
        assert "ACTIVE" in message

    def test_valid_overruled_case(self):
        citation = {
            "raw": "S v Dlamini (HC 12/2014)",
            "type": "case",
            "case_name": "S v Dlamini",
            "court_abbr": "HC",
            "case_number": "12/2014",
            "normalized": "s v dlamini hc 12/2014",
        }
        status, message = verify_citation(citation, CORPUS_DB)
        assert status == "VALID"
        assert "OVERRULED" in message.upper()

    def test_valid_distinguished_case(self):
        citation = {
            "raw": "S v Khumalo (HC 34/2020)",
            "type": "case",
            "case_name": "S v Khumalo",
            "court_abbr": "HC",
            "case_number": "34/2020",
            "normalized": "s v khumalo hc 34/2020",
        }
        status, message = verify_citation(citation, CORPUS_DB)
        assert status == "VALID"
        assert "DISTINGUISHED" in message.upper()

    def test_amber_fuzzy_match(self):
        citation = {
            "raw": "R v Dlamini",
            "type": "case",
            "case_name": "R v Dlamini",
            "court_abbr": "",
            "case_number": "",
            "normalized": "r v dlamini",
        }
        status, message = verify_citation(citation, CORPUS_DB)
        # Case name fuzzy match — format recognized but not exact
        assert status in ("AMBER", "NOT_FOUND")

    def test_not_found_unrecognized(self):
        citation = {
            "raw": "R v Fabricated Case (SZHC 99/9999)",
            "type": "case",
            "case_name": "R v Fabricated Case",
            "court_abbr": "SZHC",
            "case_number": "99/9999",
            "normalized": "r v fabricated case szhc 99/9999",
        }
        status, message = verify_citation(citation, CORPUS_DB)
        assert status == "NOT_FOUND"

    def test_not_found_statute_not_in_corpus(self):
        citation = {
            "raw": "Section 999Z CPA",
            "type": "statute",
            "section": "999Z",
            "act": "CPA",
            "normalized": "section 999z cpa",
        }
        status, message = verify_citation(citation, CORPUS_DB)
        assert status == "NOT_FOUND"


class TestVerifyCitations:
    def test_batch_verification(self):
        citations = [
            {
                "raw": "R v Dlamini (SZHC 45/2018)",
                "type": "case",
                "case_name": "R v Dlamini",
                "court_abbr": "SZHC",
                "case_number": "45/2018",
                "normalized": "r v dlamini szhc 45/2018",
            },
            {
                "raw": "R v Fabricated (SZHC 99/9999)",
                "type": "case",
                "case_name": "R v Fabricated",
                "court_abbr": "SZHC",
                "case_number": "99/9999",
                "normalized": "r v fabricated szhc 99/9999",
            },
        ]
        results = verify_citations(citations, CORPUS_DB)
        assert len(results) == 2
        statuses = {r["status"] for r in results}
        assert "VALID" in statuses
        assert "NOT_FOUND" in statuses

    def test_empty_list_returns_empty(self):
        assert verify_citations([]) == []
