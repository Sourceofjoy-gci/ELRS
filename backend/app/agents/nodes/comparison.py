import logging
from app.agents.state import LegalResearchState
from app.agents.nodes.statute import _call_agent, _retrieve_chunks
from app.core.config import get_settings

settings = get_settings()


async def comparison_node(state: LegalResearchState, db) -> LegalResearchState:
    if "COMPARISON" not in state["routing_decision"].get("agents", []):
        return state

    chunks = await _retrieve_chunks(state["query"], state.get("filters", {}), db)

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    result = await _call_agent(state["query"], chunks, settings.ollama_primary_model, "comparison")

    state["comparison_result"] = result
    state["agent_trace"].append({
        "agent": "comparison",
        "action": "comparative_analysis",
        "chunks_found": len(chunks),
        "top_score": result.get("top_score", 0),
        "latency_ms": 0,
        "model_used": settings.ollama_primary_model,
    })

    return state
