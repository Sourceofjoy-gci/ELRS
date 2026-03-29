import json
import time
import logging
from app.agents.state import LegalResearchState
from app.agents.citation_normalizer import normalize_citations
from app.agents.router import load_prompt
from app.llm.ollama_client import get_ollama_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def synthesis_node(state: LegalResearchState, db) -> LegalResearchState:
    """Synthesize all specialist results into a final answer."""
    start_time = time.time()
    ollama = get_ollama_client()

    all_results = []
    if state.get("statute_result"):
        all_results.append(f"STATUTE ANALYSIS:\n{json.dumps(state['statute_result'], indent=2)}")
    if state.get("constitutional_result"):
        all_results.append(f"CONSTITUTIONAL ANALYSIS:\n{json.dumps(state['constitutional_result'], indent=2)}")
    if state.get("case_law_result"):
        all_results.append(f"CASE LAW ANALYSIS:\n{json.dumps(state['case_law_result'], indent=2)}")
    if state.get("comparison_result"):
        all_results.append(f"COMPARISON ANALYSIS:\n{json.dumps(state['comparison_result'], indent=2)}")

    synthesis_prompt = load_prompt("synthesis")

    # Normalize citations from all specialists to LegalCitation[]
    normalized_citations = normalize_citations(state)
    normalized_json = json.dumps(normalized_citations, indent=2)

    messages = [
        {"role": "system", "content": synthesis_prompt},
        {"role": "user", "content": (
            f"Original Query: {state['query']}\n\n"
            f"Specialist Agent Results:\n\n" + "\n\n".join(all_results) + "\n\n"
            f"Normalized Citations (use these for your references section):\n{normalized_json}"
        )},
    ]

    try:
        response = await ollama.chat(messages, model=settings.ollama_fallback_model)
        content = response.get("message", {}).get("content", "")

        try:
            synthesis = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            synthesis = json.loads(content_clean)

        state["final_answer"] = synthesis.get("direct_answer", "") + "\n\n" + synthesis.get("analysis", {}).get("detailed_analysis", "")
        state["confidence"] = synthesis.get("confidence", "MEDIUM")
        state["disclaimer"] = synthesis.get("disclaimer", "This response is for legal research purposes only...")
        state["sources"] = synthesis.get("references", [])

    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        state["final_answer"] = "An error occurred during synthesis."
        state["confidence"] = "LOW"
        state["disclaimer"] = "This response is for legal research purposes only..."
        state["sources"] = []

    latency_ms = int((time.time() - start_time) * 1000)
    state["agent_trace"].append({
        "agent": "synthesis",
        "action": "synthesis_generation",
        "latency_ms": latency_ms,
        "model_used": settings.ollama_fallback_model,
    })

    return state
