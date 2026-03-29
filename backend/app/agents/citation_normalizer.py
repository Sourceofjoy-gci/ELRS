from typing import Literal, TypedDict, Any, Dict, List, Union

CitationType = Literal["statute", "constitutional", "case_law", "comparison"]


class LegalCitation(TypedDict):
    """Normalized citation format used at the synthesis boundary."""
    type: CitationType
    identifier: str        # Human-readable citation, e.g. "Employment Act, 1980, s 35"
    text: str            # Excerpt from the source
    metadata: Dict[str, Any]  # Domain-specific fields preserved


def normalize_statute_citation(citation: Dict[str, Any]) -> LegalCitation:
    """Transform statute citation format to LegalCitation."""
    act = citation.get("act", "")
    year = citation.get("year", "n.d.")
    section = citation.get("section", "N/A")
    return LegalCitation(
        type="statute",
        identifier=f"{act}, {year}, s {section}",
        text=citation.get("excerpt", ""),
        metadata={
            "act": act,
            "year": year,
            "section": section,
            "related_provisions": citation.get("related_provisions", []),
        },
    )


def normalize_constitutional_citation(citation: Dict[str, Any]) -> LegalCitation:
    """Transform constitutional citation format to LegalCitation."""
    section = citation.get("section", "N/A")
    return LegalCitation(
        type="constitutional",
        identifier=f"Constitution of the Kingdom of Eswatini, 2005, s {section}",
        text=citation.get("excerpt", ""),
        metadata={
            "chapter": citation.get("chapter"),
            "section": section,
            "right": citation.get("right"),
            "related_constitutional_provisions": citation.get("related_constitutional_provisions", []),
        },
    )


def normalize_case_law_citation(citation: Dict[str, Any]) -> LegalCitation:
    """Transform case_law citation format to LegalCitation."""
    case_name = citation.get("case_name", "")
    year = citation.get("year", "")
    court = citation.get("court", "")
    return LegalCitation(
        type="case_law",
        identifier=f"{case_name}, {year} {court}",
        text=citation.get("summary", citation.get("excerpt", "")),
        metadata={
            "case_name": case_name,
            "court": court,
            "year": year,
            "citation": citation.get("citation"),
            "precedential_value": citation.get("precedential_value"),
        },
    )


def normalize_comparison_item(comparison: Dict[str, Any]) -> List[LegalCitation]:
    """Transform comparison agent output item to LegalCitation list.

    Comparison compares two provisions — we create two LegalCitations.
    """
    citations = []
    for provision_key in ("provision_1", "provision_2"):
        provision = comparison.get(provision_key, "")
        if provision:
            citations.append(LegalCitation(
                type="comparison",
                identifier=provision,
                text=comparison.get("analysis", ""),
                metadata={
                    "relationship": comparison.get("relationship"),
                    "provision_1": comparison.get("provision_1"),
                    "provision_2": comparison.get("provision_2"),
                },
            ))
    return citations


def normalize_citations(agent_outputs: Dict[str, Any]) -> List[LegalCitation]:
    """Normalize all domain-specific citation formats to LegalCitation[].

    Called in synthesis_node before passing to synthesis agent.
    Returns a homogeneous list regardless of which specialists ran.
    """
    normalized: List[LegalCitation] = []

    if agent_outputs.get("statute_result"):
        for citation in agent_outputs["statute_result"].get("citations", []):
            normalized.append(normalize_statute_citation(citation))

    if agent_outputs.get("constitutional_result"):
        for citation in agent_outputs["constitutional_result"].get("citations", []):
            normalized.append(normalize_constitutional_citation(citation))

    if agent_outputs.get("case_law_result"):
        for citation in agent_outputs["case_law_result"].get("citations", []):
            normalized.append(normalize_case_law_citation(citation))

    if agent_outputs.get("comparison_result"):
        for comparison in agent_outputs["comparison_result"].get("comparisons", []):
            normalized.extend(normalize_comparison_item(comparison))

    return normalized