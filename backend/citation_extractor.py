"""
Citation extraction and verification — pure functions.
No Flask dependencies. Import directly in tests.
"""

import re
import sqlite3
from typing import Literal

# ─── Regex patterns as module constants (DRY) ───────────────────────────────────

CASE_CITATION_RE = re.compile(
    r'\b([A-Z][a-zA-Z]*(?:\s+(?:v\.?|versus)\s+[A-Z][a-zA-Z]*)+)'
    r'\s*(?:\(([A-Z]{2,4})\s+(\d+/\d+)\)|\[[\d]{4}\]|\([\d]{4}\))',
    re.VERBOSE | re.IGNORECASE
)

STATUTE_RE = re.compile(
    r'\b(?:section|s\.|s\s|art\.|article)\s*(\d+[A-Z]?)'
    r'(?:\s*(?:of\s+)?(?:the\s+)?([A-Z][A-Za-z\s]+?))?'
    r'(?:\s*,?\s*(?:act|law|code|constitution|cpa|criminal\s+procedure\s+act))?',
    re.IGNORECASE
)

CONSTITUTION_RE = re.compile(
    r'\b(?:article|art\.?)\s*(\d+[A-Z]?)'
    r'(?:\s*,?\s*(?:of\s+)?(?:the\s+)?(?:constitution))?',
    re.IGNORECASE
)

PARAGRAPH_RE = re.compile(
    r'\b(?:para\.?|paragraph|at\s+para\.?|at\s+\|)(\d+)',
    re.IGNORECASE
)


# ─── Normalization ──────────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    """Strip whitespace, lowercase, collapse spaces."""
    return ' '.join(text.lower().split())


def normalize_citation_for_lookup(citation: str) -> str:
    """
    Normalize a citation string for exact-match lookup.
    Strips court abbreviation noise.
    """
    return normalize(citation).replace('(', '').replace(')', '').replace('[', '').replace(']', '')


# ─── Citation extraction ──────────────────────────────────────────────────────

def extract_citations(text: str) -> list[dict]:
    """
    Extract all legal citations from plain text.

    Returns list of dicts:
      { "raw": "...", "type": "case"|"statute"|"constitution", "normalized": "..." }
    """
    if not text or not text.strip():
        return []

    results = []

    # Case citations
    for match in CASE_CITATION_RE.finditer(text):
        case_name = match.group(1).strip()
        court_abbr = match.group(2) or ''
        case_number = match.group(3) or ''
        citation_str = match.group(0).strip()

        results.append({
            "raw": citation_str,
            "type": "case",
            "case_name": case_name,
            "court_abbr": court_abbr,
            "case_number": case_number,
            "normalized": normalize_citation_for_lookup(citation_str),
        })

    # Statute sections
    for match in STATUTE_RE.finditer(text):
        section_num = match.group(1) or ''
        act_name = match.group(2) or ''
        citation_str = match.group(0).strip()

        results.append({
            "raw": citation_str,
            "type": "statute",
            "section": section_num,
            "act": act_name.strip(),
            "normalized": normalize_citation_for_lookup(citation_str),
        })

    # Constitutional provisions
    for match in CONSTITUTION_RE.finditer(text):
        article_num = match.group(1) or ''
        citation_str = match.group(0).strip()

        results.append({
            "raw": citation_str,
            "type": "constitution",
            "article": article_num,
            "normalized": normalize_citation_for_lookup(citation_str),
        })

    return results


# ─── Verification ──────────────────────────────────────────────────────────────

VerificationResult = Literal["VALID", "AMBER", "NOT_FOUND"]


def verify_citation(
    citation: dict,
    corpus_db: str = "corpus.db"
) -> tuple[VerificationResult, str]:
    """
    Verify a single citation against the corpus.

    Returns (status, message):
      VALID + "Case name (citation) — ACTIVE/OVERRULED"
      AMBER + "Citation format recognized but not in corpus — verify manually"
      NOT_FOUND + "Not recognized as valid Eswatini law"
    """
    normalized = citation["normalized"]
    conn = sqlite3.connect(corpus_db)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        # Step 1: exact match on citation field (case-insensitive via COLLATE NOCASE)
        cur.execute(
            "SELECT case_name, citation, case_status FROM judgments WHERE citation = ? COLLATE NOCASE",
            (normalized,)
        )
        row = cur.fetchone()
        if row:
            status = row["case_status"] or "active"
            if status == "active":
                return "VALID", f"{row['case_name']} ({row['citation']}) — ACTIVE"
            else:
                return "VALID", f"{row['case_name']} ({row['citation']}) — {status.upper()} — may no longer be good law"

        # Step 2: fuzzy match on case_name + year (for citations without full citation string)
        if citation["type"] == "case":
            case_name = citation.get("case_name", "")
            cur.execute(
                "SELECT case_name, citation, case_status FROM judgments WHERE case_name LIKE ? LIMIT 5",
                (f"%{case_name}%",)
            )
            matches = cur.fetchall()
            if matches:
                return "AMBER", (
                    f"{citation['raw']} — format recognized, case name found but citation not exact match. "
                    "Verify manually."
                )

        # Step 3: not found
        return "NOT_FOUND", f"{citation['raw']} — not recognized as valid Eswatini law"

    finally:
        conn.close()


def verify_citations(citations: list[dict], corpus_db: str = "corpus.db") -> list[dict]:
    """
    Verify a list of extracted citations.
    Returns list of {citation, status, message}.
    """
    if not citations:
        return []

    return [
        {
            "citation": c["raw"],
            "type": c["type"],
            "status": status,
            "message": message,
        }
        for c in citations
        for status, message in [verify_citation(c, corpus_db)]
    ]
