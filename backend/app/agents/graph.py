import json
import logging
import time
import uuid
from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langgraph.types import Send
from langgraph.graph import StateGraph, END
import operator
from sqlalchemy.ext.asyncio import AsyncSession
from app.llm.ollama_client import get_ollama_client
from app.retrieval.hybrid_retriever import HybridRetriever
from app.core.config import get_settings
from app.retrieval.models import RetrievedChunk

logger = logging.getLogger(__name__)
settings = get_settings()


class LegalResearchState(TypedDict):
    query: str
    user_id: str
    filters: Dict[str, Any]
    routing_decision: Dict[str, Any]
    statute_result: Optional[Dict[str, Any]]
    constitutional_result: Optional[Dict[str, Any]]
    case_law_result: Optional[Dict[str, Any]]
    comparison_result: Optional[Dict[str, Any]]
    subsidiary_result: Optional[Dict[str, Any]]
    retrieved_chunks: Annotated[List[Dict[str, Any]], operator.add]
    agent_trace: Annotated[List[Dict[str, Any]], operator.add]
    final_answer: str
    sources: List[Dict[str, Any]]
    confidence: str
    disclaimer: str


def _get_db_from_config(config) -> AsyncSession:
    """Extract db session from LangGraph config."""
    return config.get("configurable", {}).get("db") if config else None


def load_prompt(prompt_name: str) -> str:
    try:
        with open(f"prompts/agents/{prompt_name}.md", "r") as f:
            return f.read()
    except FileNotFoundError:
        try:
            with open(f"backend/prompts/agents/{prompt_name}.md", "r") as f:
                return f.read()
        except FileNotFoundError:
            logger.warning(f"Prompt file not found: {prompt_name}")
            return ""


async def router_node(state: LegalResearchState, config=None) -> LegalResearchState:
    db = _get_db_from_config(config)
    start_time = time.time()
    ollama = get_ollama_client()

    router_prompt = load_prompt("router")
    messages = [
        {"role": "system", "content": router_prompt},
        {"role": "user", "content": state["query"]},
    ]

    try:
        response = await ollama.chat(messages, model=settings.ollama_router_model)
        content = response.get("message", {}).get("content", "")

        try:
            routing = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            routing = json.loads(content_clean)

        state["routing_decision"] = {
            "agents": routing.get("agents", ["STATUTE"]),
            "reasoning": routing.get("reasoning", ""),
            "confidence": routing.get("confidence", 0.5),
            "query_type": routing.get("query_type", "general"),
        }

    except Exception as e:
        logger.error(f"Router error: {e}")
        state["routing_decision"] = {
            "agents": ["STATUTE"],
            "reasoning": "Default routing due to error",
            "confidence": 0.3,
            "query_type": "general",
        }

    latency_ms = int((time.time() - start_time) * 1000)
    state["agent_trace"].append({
        "agent": "router",
        "action": "routing_decision",
        "latency_ms": latency_ms,
        "model_used": settings.ollama_router_model,
    })

    return state


async def _retrieve_chunks(query: str, filters: Dict[str, Any], db: AsyncSession) -> List[RetrievedChunk]:
    retriever = HybridRetriever(db)
    return await retriever.retrieve(query, top_k=settings.retrieval_top_k, filters=filters)


async def _call_agent(
    agent_name: str,
    prompt_template: str,
    query: str,
    chunks: List[RetrievedChunk],
    model: str,
    db: AsyncSession,
) -> Dict[str, Any]:
    start_time = time.time()
    ollama = get_ollama_client()

    context = "\n\n".join([
        f"[{chunk.act_name}, {chunk.year or 'n.d.'}, s {chunk.section_number or 'N/A'}: {chunk.content[:500]}...]"
        for chunk in chunks[:5]
    ])

    messages = [
        {"role": "system", "content": prompt_template},
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
        logger.error(f"{agent_name} error: {e}")
        result = {
            "answer": f"Error processing {agent_name} agent: {str(e)}",
            "citations": [],
            "confidence": "LOW",
            "caveats": "An error occurred during processing.",
            "chunks_used": 0,
            "top_score": 0,
        }

    latency_ms = int((time.time() - start_time) * 1000)
    return {
        "result": result,
        "latency_ms": latency_ms,
        "model_used": model,
    }


async def statute_node(state: LegalResearchState, config=None) -> dict:
    """Statute specialist — returns only statute_result to avoid concurrent write conflicts."""
    db = _get_db_from_config(config)
    chunks = await _retrieve_chunks(state["query"], state.get("filters", {}), db)
    prompt = load_prompt("statute")
    agent_output = await _call_agent(
        "statute",
        prompt,
        state["query"],
        chunks,
        settings.ollama_primary_model,
        db,
    )
    return {
        "statute_result": agent_output["result"],
        "statute_trace": {
            "action": "statute_analysis",
            "chunks_found": len(chunks),
            "top_score": agent_output["result"].get("top_score", 0),
            "latency_ms": agent_output["latency_ms"],
            "model_used": agent_output["model_used"],
        },
    }


async def constitutional_node(state: LegalResearchState, config=None) -> dict:
    """Constitutional specialist — returns only constitutional_result to avoid concurrent write conflicts."""
    db = _get_db_from_config(config)
    filters = state.get("filters", {})
    filters["doc_type"] = "constitution"
    chunks = await _retrieve_chunks(state["query"], filters, db)
    prompt = load_prompt("constitutional")
    agent_output = await _call_agent(
        "constitutional",
        prompt,
        state["query"],
        chunks,
        settings.ollama_primary_model,
        db,
    )
    return {
        "constitutional_result": agent_output["result"],
        "constitutional_trace": {
            "action": "constitutional_analysis",
            "chunks_found": len(chunks),
            "top_score": agent_output["result"].get("top_score", 0),
            "latency_ms": agent_output["latency_ms"],
            "model_used": agent_output["model_used"],
        },
    }


async def case_law_node(state: LegalResearchState, config=None) -> dict:
    """Case law specialist — returns only case_law_result to avoid concurrent write conflicts."""
    db = _get_db_from_config(config)
    filters = state.get("filters", {})
    filters["doc_type"] = "case_law"
    chunks = await _retrieve_chunks(state["query"], filters, db)
    prompt = load_prompt("case_law")
    agent_output = await _call_agent(
        "case_law",
        prompt,
        state["query"],
        chunks,
        settings.ollama_primary_model,
        db,
    )
    return {
        "case_law_result": agent_output["result"],
        "case_law_trace": {
            "action": "case_law_analysis",
            "chunks_found": len(chunks),
            "top_score": agent_output["result"].get("top_score", 0),
            "latency_ms": agent_output["latency_ms"],
            "model_used": agent_output["model_used"],
        },
    }


async def comparison_node(state: LegalResearchState, config=None) -> dict:
    """Comparison specialist — returns only comparison_result to avoid concurrent write conflicts."""
    db = _get_db_from_config(config)
    chunks = await _retrieve_chunks(state["query"], state.get("filters", {}), db)
    prompt = load_prompt("comparison")
    agent_output = await _call_agent(
        "comparison",
        prompt,
        state["query"],
        chunks,
        settings.ollama_primary_model,
        db,
    )
    return {
        "comparison_result": agent_output["result"],
        "comparison_trace": {
            "action": "comparative_analysis",
            "chunks_found": len(chunks),
            "top_score": agent_output["result"].get("top_score", 0),
            "latency_ms": agent_output["latency_ms"],
            "model_used": agent_output["model_used"],
        },
    }


async def subsidiary_node(state: LegalResearchState, config=None) -> dict:
    """SI/regulations specialist."""
    db = _get_db_from_config(config)
    chunks = await _retrieve_chunks(state["query"], state.get("filters", {}), db)
    prompt = load_prompt("subsidiary")
    agent_output = await _call_agent(
        "subsidiary",
        prompt,
        state["query"],
        chunks,
        settings.ollama_primary_model,
        db,
    )
    return {
        "subsidiary_result": agent_output["result"],
        "subsidiary_trace": {
            "action": "subsidiary_analysis",
            "chunks_found": len(chunks),
            "top_score": agent_output["result"].get("top_score", 0),
            "latency_ms": agent_output["latency_ms"],
            "model_used": agent_output["model_used"],
        },
    }


async def synthesis_node(state: LegalResearchState, config=None) -> LegalResearchState:
    db = _get_db_from_config(config)
    start_time = time.time()
    ollama = get_ollama_client()

    # Build agent_trace from specialist trace fields
    for agent_name, trace_field in [
        ("statute", "statute_trace"),
        ("constitutional", "constitutional_trace"),
        ("case_law", "case_law_trace"),
        ("comparison", "comparison_trace"),
        ("subsidiary", "subsidiary_trace"),
    ]:
        if state.get(trace_field):
            state["agent_trace"].append({**({"agent": agent_name}), **state[trace_field]})

    all_results = []
    if state.get("statute_result"):
        all_results.append(f"STATUTE ANALYSIS:\n{json.dumps(state['statute_result'], indent=2)}")
    if state.get("constitutional_result"):
        all_results.append(f"CONSTITUTIONAL ANALYSIS:\n{json.dumps(state['constitutional_result'], indent=2)}")
    if state.get("case_law_result"):
        all_results.append(f"CASE LAW ANALYSIS:\n{json.dumps(state['case_law_result'], indent=2)}")
    if state.get("comparison_result"):
        all_results.append(f"COMPARISON ANALYSIS:\n{json.dumps(state['comparison_result'], indent=2)}")
    if state.get("subsidiary_result"):
        all_results.append(f"SUBSIDIARY LEGISLATION ANALYSIS:\n{json.dumps(state['subsidiary_result'], indent=2)}")

    synthesis_prompt = load_prompt("synthesis")
    messages = [
        {"role": "system", "content": synthesis_prompt},
        {"role": "user", "content": f"Original Query: {state['query']}\n\nSpecialist Agent Results:\n\n" + "\n\n".join(all_results)},
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


def should_run_agent(agent_name: str):
    def check(state: LegalResearchState) -> bool:
        return agent_name in state["routing_decision"].get("agents", [])
    return check


def route_from_router(state: LegalResearchState) -> list[Send]:
    """
    Fan out to all relevant specialist nodes in parallel via Send.
    Each specialist receives a partial state and returns only its result field,
    avoiding concurrent write conflicts when multiple specialists run.
    """
    agents = state["routing_decision"].get("agents", [])
    specialist_state = {
        "query": state["query"],
        "user_id": state["user_id"],
        "filters": state.get("filters", {}),
        "routing_decision": state["routing_decision"],
    }

    sends = []
    if "STATUTE" in agents:
        sends.append(Send("statute", specialist_state))
    if "CONSTITUTIONAL" in agents:
        sends.append(Send("constitutional", specialist_state))
    if "CASE_LAW" in agents:
        sends.append(Send("case_law", specialist_state))
    if "COMPARISON" in agents:
        sends.append(Send("comparison", specialist_state))
    if "SUBSIDIARY" in agents:
        sends.append(Send("subsidiary", specialist_state))

    return sends


def create_legal_research_graph():
    workflow = StateGraph(LegalResearchState)

    workflow.add_node("router", router_node)
    workflow.add_node("statute", statute_node)
    workflow.add_node("constitutional", constitutional_node)
    workflow.add_node("case_law", case_law_node)
    workflow.add_node("comparison", comparison_node)
    workflow.add_node("subsidiary", subsidiary_node)
    workflow.add_node("synthesis", synthesis_node)

    workflow.set_entry_point("router")

    workflow.add_conditional_edges(
        "router",
        route_from_router,
        ["statute", "constitutional", "case_law", "comparison", "subsidiary"],
    )

    workflow.add_edge("statute", "synthesis")
    workflow.add_edge("constitutional", "synthesis")
    workflow.add_edge("case_law", "synthesis")
    workflow.add_edge("comparison", "synthesis")
    workflow.add_edge("subsidiary", "synthesis")

    workflow.add_edge("synthesis", END)

    return workflow.compile()


async def run_legal_research_graph(
    query: str,
    user_id: str,
    filters: Dict[str, Any],
    db: AsyncSession,
) -> LegalResearchState:
    graph = create_legal_research_graph()

    initial_state = LegalResearchState(
        query=query,
        user_id=user_id,
        filters=filters,
        routing_decision={},
        statute_result=None,
        constitutional_result=None,
        case_law_result=None,
        comparison_result=None,
        retrieved_chunks=[],
        agent_trace=[],
        final_answer="",
        sources=[],
        confidence="MEDIUM",
        disclaimer="This response is for legal research purposes only...",
    )

    result = await graph.ainvoke(initial_state, {"configurable": {"db": db}})
    return result
