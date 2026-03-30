from typing import Dict, Any
from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import LegalResearchState
from app.agents.router import router_node
from app.agents.nodes.statute import statute_node
from app.agents.nodes.constitutional import constitutional_node
from app.agents.nodes.case_law import case_law_node
from app.agents.nodes.comparison import comparison_node
from app.agents.nodes.synthesis import synthesis_node


# Valid specialist agent names (must match node names in the graph)
VALID_AGENTS = {"statute", "constitutional", "case_law", "comparison"}


def build_routing_map(state: LegalResearchState) -> str:
    """Determine next node after router or any specialist based on routing_decision."""
    agents = state["routing_decision"].get("agents", [])
    visited = {e["agent"] for e in state["agent_trace"] if e["agent"] != "router"}

    for agent in agents:
        agent_key = agent.lower()
        if agent_key in VALID_AGENTS and agent_key not in visited:
            return agent_key

    return "synthesis"


def create_legal_research_graph():
    workflow = StateGraph(LegalResearchState)

    async def router_wrapper(state, config):
        db = config.get("configurable", {}).get("db")
        return await router_node(state, db)

    async def statute_wrapper(state, config):
        db = config.get("configurable", {}).get("db")
        return await statute_node(state, db)

    async def constitutional_wrapper(state, config):
        db = config.get("configurable", {}).get("db")
        return await constitutional_node(state, db)

    async def case_law_wrapper(state, config):
        db = config.get("configurable", {}).get("db")
        return await case_law_node(state, db)

    async def comparison_wrapper(state, config):
        db = config.get("configurable", {}).get("db")
        return await comparison_node(state, db)

    async def synthesis_wrapper(state, config):
        db = config.get("configurable", {}).get("db")
        return await synthesis_node(state, db)

    workflow.add_node("router", router_wrapper)
    workflow.add_node("statute", statute_wrapper)
    workflow.add_node("constitutional", constitutional_wrapper)
    workflow.add_node("case_law", case_law_wrapper)
    workflow.add_node("comparison", comparison_wrapper)
    workflow.add_node("synthesis", synthesis_wrapper)

    workflow.set_entry_point("router")

    workflow.add_conditional_edges(
        "router",
        build_routing_map,
        {
            "statute": "statute",
            "constitutional": "constitutional",
            "case_law": "case_law",
            "comparison": "comparison",
            "synthesis": "synthesis",
        }
    )

    workflow.add_conditional_edges("statute", build_routing_map, {
        "constitutional": "constitutional", "case_law": "case_law",
        "comparison": "comparison", "synthesis": "synthesis",
    })
    workflow.add_conditional_edges("constitutional", build_routing_map, {
        "statute": "statute", "case_law": "case_law",
        "comparison": "comparison", "synthesis": "synthesis",
    })
    workflow.add_conditional_edges("case_law", build_routing_map, {
        "statute": "statute", "constitutional": "constitutional",
        "comparison": "comparison", "synthesis": "synthesis",
    })
    workflow.add_conditional_edges("comparison", build_routing_map, {
        "statute": "statute", "constitutional": "constitutional",
        "case_law": "case_law", "synthesis": "synthesis",
    })

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
