import time
import json
import logging
from typing import List
from app.agents.state import LegalResearchState
from app.agents.router import load_prompt
from app.llm.ollama_client import get_ollama_client
from app.retrieval.hybrid_retriever import HybridRetriever
from app.retrieval.models import RetrievedChunk
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def _retrieve_chunks(query: str, filters: dict, db) -> List[RetrievedChunk]:
    """Retrieve relevant document chunks for the query."""
    retriever = HybridRetriever(db)
    return await retriever.retrieve(query, top_k=settings.retrieval_top_k, filters=filters)


async def _call_agent(
    query: str,
    chunks: List[RetrievedChunk],
    model: str,
    prompt_name: str,
) -> dict:
    """Call a specialist agent with retrieved chunks."""
    import json
    ollama = get_ollama_client()

    context = "\n\n".join([
        f"[{chunk.act_name}, {chunk.year or 'n.d.'}, s {chunk.section_number or 'N/A'}: {chunk.content[:500]}...]"
        for chunk in chunks[:5]
    ])

    prompt = load_prompt(prompt_name)
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Query: {query}\n\nRelevant Legal Context:\n{context}"},
    ]

    try:
        response = await ollama.chat(messages, model=model)
        content = response.get("message", {}).get("content", "")

        try:
            result = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            result = json.loads(content_clean)

        result["chunks_used"] = len(chunks)
        result["top_score"] = max([c.reranker_score or 0 for c in chunks]) if chunks else 0

    except Exception as e:
        logger.error(f"Agent error: {e}")
        result = {
            "answer": f"Error: {str(e)}",
            "citations": [],
            "confidence": "LOW",
            "caveats": "An error occurred during processing.",
            "chunks_used": 0,
            "top_score": 0,
        }

    return result


async def statute_node(state: LegalResearchState, db) -> LegalResearchState:
    """Analyze statutory law."""
    if "STATUTE" not in state["routing_decision"].get("agents", []):
        return state

    chunks = await _retrieve_chunks(state["query"], state.get("filters", {}), db)

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    result = await _call_agent(state["query"], chunks, settings.ollama_primary_model, "statute")

    state["statute_result"] = result
    state["agent_trace"].append({
        "agent": "statute",
        "action": "statute_analysis",
        "chunks_found": len(chunks),
        "top_score": result.get("top_score", 0),
        "latency_ms": 0,
        "model_used": settings.ollama_primary_model,
    })

    return state
