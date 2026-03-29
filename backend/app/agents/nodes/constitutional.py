import logging
from app.agents.state import LegalResearchState
from app.agents.nodes.statute import _call_agent, _retrieve_chunks
from app.core.config import get_settings

settings = get_settings()


async def constitutional_node(state: LegalResearchState, db) -> LegalResearchState:
    """Analyze constitutional law."""
    if "CONSTITUTIONAL" not in state["routing_decision"].get("agents", []):
        return state

    filters = dict(state.get("filters", {}))
    filters["doc_type"] = "constitution"
    chunks = await _retrieve_chunks(state["query"], filters, db)

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    result = await _call_agent(state["query"], chunks, settings.ollama_primary_model, "constitutional")

    state["constitutional_result"] = result
    state["agent_trace"].append({
        "agent": "constitutional",
        "action": "constitutional_analysis",
        "chunks_found": len(chunks),
        "top_score": result.get("top_score", 0),
        "latency_ms": 0,
        "model_used": settings.ollama_primary_model,
    })

    return state
