# ELRI Technical Debt Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the critical LangGraph routing bug, split the monolithic agent graph, implement citation normalization, build test fixtures, and consolidate the frontend API layer.

**Architecture:** Five sequential steps. Each step is independently deployable. Citation normalization uses a hybrid approach — domain-specific formats preserved internally, generic `LegalCitation` only at the synthesis boundary.

**Tech Stack:** Python/FastAPI (backend), LangGraph (agent orchestration), Next.js/TypeScript (frontend), SQLite in-memory (tests), Ollama (LLM).

---

## Step 1 — Fix Critical Routing Bug

**Goal:** Fix LangGraph conditional edges so all four specialist agents are reachable, not just `statute`.

### Task 1.1: Add routing tests for all specialist agent types

**Files:**
- Modify: `backend/tests/integration/test_agent_routing.py`

- [ ] **Step 1: Write failing test for all four specialist routing paths**

```python
# backend/tests/integration/test_agent_routing.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.graph import create_legal_research_graph, LegalResearchState

@pytest.fixture
def mock_ollama_response():
    """Return a mock Ollama chat response."""
    def make_response(content: str):
        return {"message": {"content": content}}
    return make_response

@pytest.mark.asyncio
async def test_router_routes_to_statute_agent(mock_ollama_response):
    """Router returns STATUTE → statute_node should be reachable."""
    graph = create_legal_research_graph()

    # Mock Ollama to return a routing decision for STATUTE only
    async def mock_chat(messages, model):
        content = '{"agents": ["STATUTE"], "reasoning": "statutory query", "confidence": 0.9, "query_type": "statutory"}'
        return mock_ollama_response(content)

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        mock_client.return_value.chat.return_value = mock_chat(None, None)

        initial_state: LegalResearchState = {
            "query": "What does section 35 of the Employment Act say?",
            "user_id": "test-user-id",
            "filters": {},
            "routing_decision": {},
            "statute_result": None,
            "constitutional_result": None,
            "case_law_result": None,
            "comparison_result": None,
            "retrieved_chunks": [],
            "agent_trace": [],
            "final_answer": "",
            "sources": [],
            "confidence": "MEDIUM",
            "disclaimer": "",
        }

        # This will fail currently because the graph only routes STATUTE → statute → synthesis
        # and constitutional/case_law/comparison are unreachable
        result = await graph.ainvoke(initial_state, {"configurable": {"db": MagicMock()}})

        # Verify router set the routing_decision
        assert result["routing_decision"]["agents"] == ["STATUTE"]
        # Verify statute node ran
        assert result["statute_result"] is not None
        # Verify constitutional node DID NOT run (not routed)
        assert result["constitutional_result"] is None

@pytest.mark.asyncio
async def test_router_routes_to_multiple_agents(mock_ollama_response):
    """Router returns multiple agents → all should be reachable."""
    graph = create_legal_research_graph()

    call_count = {"statute": 0, "constitutional": 0, "case_law": 0, "comparison": 0}

    async def mock_chat(messages, model):
        # Return routing for both STATUTE and CONSTITUTIONAL
        content = '{"agents": ["STATUTE", "CONSTITUTIONAL"], "reasoning": "multi-domain", "confidence": 0.85, "query_type": "mixed"}'
        return mock_ollama_response(content)

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        mock_client.return_value.chat.return_value = mock_chat(None, None)
        # Also patch _retrieve_chunks to avoid DB calls
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            initial_state: LegalResearchState = {
                "query": "Does employment law comply with constitutional rights?",
                "user_id": "test-user-id",
                "filters": {},
                "routing_decision": {},
                "statute_result": None,
                "constitutional_result": None,
                "case_law_result": None,
                "comparison_result": None,
                "retrieved_chunks": [],
                "agent_trace": [],
                "final_answer": "",
                "sources": [],
                "confidence": "MEDIUM",
                "disclaimer": "",
            }

            result = await graph.ainvoke(initial_state, {"configurable": {"db": MagicMock()}})

            # Both agents should have run
            assert result["routing_decision"]["agents"] == ["STATUTE", "CONSTITUTIONAL"]
            assert result["statute_result"] is not None, "statute should have run"
            assert result["constitutional_result"] is not None, "constitutional should have run"
            # case_law and comparison should not have run
            assert result["case_law_result"] is None
            assert result["comparison_result"] is None

@pytest.mark.asyncio
async def test_router_routes_to_case_law():
    """Router returns CASE_LAW → case_law_node should be reachable."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        content = '{"agents": ["CASE_LAW"], "reasoning": "case law query", "confidence": 0.9, "query_type": "precedent"}'
        return mock_ollama_response(content)

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        mock_client.return_value.chat.return_value = mock_chat(None, None)
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            initial_state: LegalResearchState = {
                "query": "What precedents exist for wrongful dismissal?",
                "user_id": "test-user-id",
                "filters": {},
                "routing_decision": {},
                "statute_result": None,
                "constitutional_result": None,
                "case_law_result": None,
                "comparison_result": None,
                "retrieved_chunks": [],
                "agent_trace": [],
                "final_answer": "",
                "sources": [],
                "confidence": "MEDIUM",
                "disclaimer": "",
            }

            result = await graph.ainvoke(initial_state, {"configurable": {"db": MagicMock()}})

            assert result["case_law_result"] is not None, "case_law should have run"

@pytest.mark.asyncio
async def test_router_routes_to_comparison():
    """Router returns COMPARISON → comparison_node should be reachable."""
    graph = create_legal_research_graph()

    async def mock_chat(messages, model):
        content = '{"agents": ["COMPARISON"], "reasoning": "comparative query", "confidence": 0.9, "query_type": "comparison"}'
        return mock_ollama_response(content)

    with patch("app.agents.graph.get_ollama_client") as mock_client:
        mock_client.return_value.chat = mock_chat
        mock_client.return_value.chat.return_value = mock_chat(None, None)
        with patch("app.agents.graph._retrieve_chunks", return_value=[]):
            initial_state: LegalResearchState = {
                "query": "Compare the Employment Act and Industrial Relations Act on strike rights",
                "user_id": "test-user-id",
                "filters": {},
                "routing_decision": {},
                "statute_result": None,
                "constitutional_result": None,
                "case_law_result": None,
                "comparison_result": None,
                "retrieved_chunks": [],
                "agent_trace": [],
                "final_answer": "",
                "sources": [],
                "confidence": "MEDIUM",
                "disclaimer": "",
            }

            result = await graph.ainvoke(initial_state, {"configurable": {"db": MagicMock()}})

            assert result["comparison_result"] is not None, "comparison should have run"
```

- [ ] **Step 2: Run tests to verify they fail (routing is broken)**

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/integration/test_agent_routing.py -v`
Expected: Tests for multi-agent routing FAIL — the current graph only routes `STATUTE → statute → synthesis`, never reaching `constitutional_node`, `case_law_node`, or `comparison_node`.

---

### Task 1.2: Fix add_conditional_edges in graph.py

**Files:**
- Modify: `backend/app/agents/graph.py:354-360`

- [ ] **Step 1: Fix the conditional edges — replace single-agent routing with multi-agent routing**

The current code at lines 356-360:
```python
workflow.add_conditional_edges(
    "router",
    should_run_agent("STATUTE"),
    {"statute": "statute", "__end__": "synthesis"}
)
```

Replace with:
```python
def build_routing_map(state: LegalResearchState) -> str:
    """Determine next node after router based on routing_decision.

    Returns the first unvisited specialist node, or 'synthesis' if all done.
    Agents run sequentially: router → agent → router → agent → ... → synthesis
    """
    agents = state["routing_decision"].get("agents", [])
    visited = set(e["agent"] for e in state["agent_trace"] if e["agent"] != "router")

    for agent in agents:
        agent_key = agent.lower()  # "STATUTE" -> "statute"
        if agent_key not in visited:
            return agent_key

    return "synthesis"

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
```

- [ ] **Step 2: Run routing tests to verify they pass**

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/integration/test_agent_routing.py -v`
Expected: All routing tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/graph.py backend/tests/integration/test_agent_routing.py
git commit -m "fix(agents): route to all specialist nodes not just statute

- Replace single-agent should_run_agent('STATUTE') conditional edge
  with build_routing_map() that returns first unvisited specialist
- Add integration tests for multi-agent routing (statute+constitutional,
  case_law, comparison in isolation)
- Fixes unreachable constitutional_node, case_law_node, comparison_node"
```

---

## Step 2 — Split Agent Graph into Per-Node Files

**Goal:** Replace 398-line `graph.py` with a directory of focused files.

### Task 2.1: Create agents/nodes/ directory and state.py

**Files:**
- Create: `backend/app/agents/__init__.py`
- Create: `backend/app/agents/state.py`
- Create: `backend/app/agents/nodes/__init__.py`

- [ ] **Step 1: Create state.py with LegalResearchState schema (moved from graph.py)**

```python
# backend/app/agents/state.py
from typing import TypedDict, Annotated, List, Dict, Any, Optional, Literal
import operator


class LegalResearchState(TypedDict):
    query: str
    user_id: str
    filters: Dict[str, Any]
    routing_decision: Dict[str, Any]
    statute_result: Optional[Dict[str, Any]]
    constitutional_result: Optional[Dict[str, Any]]
    case_law_result: Optional[Dict[str, Any]]
    comparison_result: Optional[Dict[str, Any]]
    retrieved_chunks: Annotated[List[Dict[str, Any]], operator.add]
    agent_trace: Annotated[List[Dict[str, Any]], operator.add]
    final_answer: str
    sources: List[Dict[str, Any]]
    confidence: str
    disclaimer: str
```

- [ ] **Step 2: Create agents/nodes/__init__.py**

```python
# backend/app/agents/nodes/__init__.py
from .statute import statute_node
from .constitutional import constitutional_node
from .case_law import case_law_node
from .comparison import comparison_node
from .synthesis import synthesis_node

__all__ = [
    "statute_node",
    "constitutional_node",
    "case_law_node",
    "comparison_node",
    "synthesis_node",
]
```

- [ ] **Step 3: Create agents/__init__.py**

```python
# backend/app/agents/__init__.py
from .graph import create_legal_research_graph, run_legal_research_graph
from .state import LegalResearchState

__all__ = ["create_legal_research_graph", "run_legal_research_graph", "LegalResearchState"]
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/agents/state.py backend/app/agents/__init__.py backend/app/agents/nodes/__init__.py
git commit -m "refactor(agents): extract LegalResearchState to state.py"
```

---

### Task 2.2: Create per-node files

**Files:**
- Create: `backend/app/agents/router.py`
- Create: `backend/app/agents/nodes/statute.py`
- Create: `backend/app/agents/nodes/constitutional.py`
- Create: `backend/app/agents/nodes/case_law.py`
- Create: `backend/app/agents/nodes/comparison.py`
- Create: `backend/app/agents/nodes/synthesis.py`

- [ ] **Step 1: Create router.py (router_node moved from graph.py)**

```python
# backend/app/agents/router.py
import json
import time
import logging
from app.agents.state import LegalResearchState
from app.llm.ollama_client import get_ollama_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


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


async def router_node(state: LegalResearchState, db) -> LegalResearchState:
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
```

- [ ] **Step 2: Create nodes/statute.py**

```python
# backend/app/agents/nodes/statute.py
import time
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
    retriever = HybridRetriever(db)
    return await retriever.retrieve(query, top_k=settings.retrieval_top_k, filters=filters)


async def _call_statute_agent(
    query: str,
    chunks: List[RetrievedChunk],
    model: str,
) -> dict:
    import json
    start_time = time.time()
    ollama = get_ollama_client()

    context = "\n\n".join([
        f"[{chunk.act_name}, {chunk.year or 'n.d.'}, s {chunk.section_number or 'N/A'}: {chunk.content[:500]}...]"
        for chunk in chunks[:5]
    ])

    prompt = load_prompt("statute")
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
        logger.error(f"statute agent error: {e}")
        result = {
            "answer": f"Error processing statute agent: {str(e)}",
            "citations": [],
            "confidence": "LOW",
            "caveats": "An error occurred during processing.",
            "chunks_used": 0,
            "top_score": 0,
        }

    return result


async def statute_node(state: LegalResearchState, db) -> LegalResearchState:
    if "STATUTE" not in state["routing_decision"].get("agents", []):
        return state

    chunks = await _retrieve_chunks(state["query"], state.get("filters", {}), db)

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    agent_output = await _call_statute_agent(
        state["query"],
        chunks,
        settings.ollama_primary_model,
    )

    state["statute_result"] = agent_output
    state["agent_trace"].append({
        "agent": "statute",
        "action": "statute_analysis",
        "chunks_found": len(chunks),
        "top_score": agent_output.get("top_score", 0),
        "latency_ms": 0,
        "model_used": settings.ollama_primary_model,
    })

    return state
```

- [ ] **Step 3: Create nodes/constitutional.py**

```python
# backend/app/agents/nodes/constitutional.py
import logging
from typing import List
from app.agents.state import LegalResearchState
from app.agents.router import load_prompt
from app.llm.ollama_client import get_ollama_client
from app.retrieval.models import RetrievedChunk
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def constitutional_node(state: LegalResearchState, db) -> LegalResearchState:
    if "CONSTITUTIONAL" not in state["routing_decision"].get("agents", []):
        return state

    filters = state.get("filters", {})
    filters["doc_type"] = "constitution"
    retriever = __import__("app.retrieval.hybrid_retriever", fromlist=["HybridRetriever"]).HybridRetriever(db)
    chunks = await retriever.retrieve(state["query"], top_k=settings.retrieval_top_k, filters=filters)

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    import json
    start_time = time.time()
    ollama = get_ollama_client()

    context = "\n\n".join([
        f"[{chunk.act_name}, {chunk.year or 'n.d.'}, s {chunk.section_number or 'N/A'}: {chunk.content[:500]}...]"
        for chunk in chunks[:5]
    ])

    prompt = load_prompt("constitutional")
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Query: {state['query']}\n\nRelevant Legal Context:\n{context}"},
    ]

    try:
        response = await ollama.chat(messages, model=settings.ollama_primary_model)
        content = response.get("message", {}).get("content", "")
        try:
            result = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            result = json.loads(content_clean)
        result["chunks_used"] = len(chunks)
        result["top_score"] = max([c.reranker_score or 0 for c in chunks]) if chunks else 0
    except Exception as e:
        logger.error(f"constitutional agent error: {e}")
        result = {
            "answer": f"Error processing constitutional agent: {str(e)}",
            "citations": [],
            "confidence": "LOW",
            "caveats": "An error occurred.",
            "chunks_used": 0,
            "top_score": 0,
        }

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
```

Note: Add `import time` at top of constitutional.py and case_law.py and comparison.py the same way statute.py does.

- [ ] **Step 4: Create nodes/case_law.py** (pattern identical to constitutional.py, agent_name="case_law", prompt="case_law", state key="case_law_result")

```python
# backend/app/agents/nodes/case_law.py
import time
import logging
import json
from typing import List
from app.agents.state import LegalResearchState
from app.agents.router import load_prompt
from app.llm.ollama_client import get_ollama_client
from app.retrieval.hybrid_retriever import HybridRetriever
from app.retrieval.models import RetrievedChunk
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def case_law_node(state: LegalResearchState, db) -> LegalResearchState:
    if "CASE_LAW" not in state["routing_decision"].get("agents", []):
        return state

    filters = state.get("filters", {})
    filters["doc_type"] = "case_law"
    retriever = HybridRetriever(db)
    chunks = await retriever.retrieve(state["query"], top_k=settings.retrieval_top_k, filters=filters)

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    start_time = time.time()
    ollama = get_ollama_client()

    context = "\n\n".join([
        f"[{chunk.act_name}, {chunk.year or 'n.d.'}, s {chunk.section_number or 'N/A'}: {chunk.content[:500]}...]"
        for chunk in chunks[:5]
    ])

    prompt = load_prompt("case_law")
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Query: {state['query']}\n\nRelevant Legal Context:\n{context}"},
    ]

    try:
        response = await ollama.chat(messages, model=settings.ollama_primary_model)
        content = response.get("message", {}).get("content", "")
        try:
            result = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            result = json.loads(content_clean)
        result["chunks_used"] = len(chunks)
        result["top_score"] = max([c.reranker_score or 0 for c in chunks]) if chunks else 0
    except Exception as e:
        logger.error(f"case_law agent error: {e}")
        result = {
            "answer": f"Error processing case_law agent: {str(e)}",
            "citations": [],
            "confidence": "LOW",
            "caveats": "An error occurred.",
            "chunks_used": 0,
            "top_score": 0,
        }

    state["case_law_result"] = result
    state["agent_trace"].append({
        "agent": "case_law",
        "action": "case_law_analysis",
        "chunks_found": len(chunks),
        "top_score": result.get("top_score", 0),
        "latency_ms": int((time.time() - start_time) * 1000),
        "model_used": settings.ollama_primary_model,
    })

    return state
```

- [ ] **Step 5: Create nodes/comparison.py** (pattern identical, agent_name="comparison", prompt="comparison", state key="comparison_result")

```python
# backend/app/agents/nodes/comparison.py
import time
import logging
import json
from typing import List
from app.agents.state import LegalResearchState
from app.agents.router import load_prompt
from app.llm.ollama_client import get_ollama_client
from app.retrieval.hybrid_retriever import HybridRetriever
from app.retrieval.models import RetrievedChunk
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def comparison_node(state: LegalResearchState, db) -> LegalResearchState:
    if "COMPARISON" not in state["routing_decision"].get("agents", []):
        return state

    retriever = HybridRetriever(db)
    chunks = await retriever.retrieve(state["query"], top_k=settings.retrieval_top_k, filters=state.get("filters", {}))

    for chunk in chunks:
        state["retrieved_chunks"].append(chunk.to_dict())

    start_time = time.time()
    ollama = get_ollama_client()

    context = "\n\n".join([
        f"[{chunk.act_name}, {chunk.year or 'n.d.'}, s {chunk.section_number or 'N/A'}: {chunk.content[:500]}...]"
        for chunk in chunks[:5]
    ])

    prompt = load_prompt("comparison")
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Query: {state['query']}\n\nRelevant Legal Context:\n{context}"},
    ]

    try:
        response = await ollama.chat(messages, model=settings.ollama_primary_model)
        content = response.get("message", {}).get("content", "")
        try:
            result = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            result = json.loads(content_clean)
        result["chunks_used"] = len(chunks)
        result["top_score"] = max([c.reranker_score or 0 for c in chunks]) if chunks else 0
    except Exception as e:
        logger.error(f"comparison agent error: {e}")
        result = {
            "answer": f"Error processing comparison agent: {str(e)}",
            "comparisons": [],
            "confidence": "LOW",
            "caveats": "An error occurred.",
            "chunks_used": 0,
            "top_score": 0,
        }

    state["comparison_result"] = result
    state["agent_trace"].append({
        "agent": "comparison",
        "action": "comparative_analysis",
        "chunks_found": len(chunks),
        "top_score": result.get("top_score", 0),
        "latency_ms": int((time.time() - start_time) * 1000),
        "model_used": settings.ollama_primary_model,
    })

    return state
```

- [ ] **Step 6: Create nodes/synthesis.py**

```python
# backend/app/agents/nodes/synthesis.py
import json
import time
import logging
from app.agents.state import LegalResearchState
from app.agents.router import load_prompt
from app.llm.ollama_client import get_ollama_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def synthesis_node(state: LegalResearchState, db) -> LegalResearchState:
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
```

- [ ] **Step 7: Rewrite graph.py to import from new structure**

Replace the entire contents of `backend/app/agents/graph.py` with:

```python
# backend/app/agents/graph.py
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


def build_routing_map(state: LegalResearchState) -> str:
    """Determine next node after any specialist based on routing_decision.

    Agents run one at a time (not in parallel). After each specialist completes,
    control returns here to decide the next step — either another specialist
    or synthesis.
    """
    agents = state["routing_decision"].get("agents", [])
    visited = {e["agent"] for e in state["agent_trace"] if e["agent"] != "router"}

    for agent in agents:
        agent_key = agent.lower()
        if agent_key not in visited:
            return agent_key

    return "synthesis"


def create_legal_research_graph():
    workflow = StateGraph(LegalResearchState)

    workflow.add_node("router", lambda state, db=None: router_node(state, db))
    workflow.add_node("statute", lambda state, db=None: statute_node(state, db))
    workflow.add_node("constitutional", lambda state, db=None: constitutional_node(state, db))
    workflow.add_node("case_law", lambda state, db=None: case_law_node(state, db))
    workflow.add_node("comparison", lambda state, db=None: comparison_node(state, db))
    workflow.add_node("synthesis", lambda state, db=None: synthesis_node(state, db))

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

    # Each specialist routes back to build_routing_map to decide next step
    workflow.add_conditional_edges(
        "statute",
        build_routing_map,
        {
            "constitutional": "constitutional",
            "case_law": "case_law",
            "comparison": "comparison",
            "synthesis": "synthesis",
        }
    )

    workflow.add_conditional_edges(
        "constitutional",
        build_routing_map,
        {
            "statute": "statute",
            "case_law": "case_law",
            "comparison": "comparison",
            "synthesis": "synthesis",
        }
    )

    workflow.add_conditional_edges(
        "case_law",
        build_routing_map,
        {
            "statute": "statute",
            "constitutional": "constitutional",
            "comparison": "comparison",
            "synthesis": "synthesis",
        }
    )

    workflow.add_conditional_edges(
        "comparison",
        build_routing_map,
        {
            "statute": "statute",
            "constitutional": "constitutional",
            "case_law": "case_law",
            "synthesis": "synthesis",
        }
    )

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
```

- [ ] **Step 8: Update test imports and patch paths for new module structure**

After the refactor, `LegalResearchState` lives in `app.agents.state`, not `app.agents.graph`. Update the test imports:

```python
# In test_agent_routing.py, update imports:
# Before:
from app.agents.graph import create_legal_research_graph, LegalResearchState
# After:
from app.agents.graph import create_legal_research_graph
from app.agents.state import LegalResearchState
```

After refactoring, nodes call `get_ollama_client()` locally. Update patches in each test from `patch("app.agents.graph.get_ollama_client")` to patch the correct module in each node file (`patch("app.agents.router.get_ollama_client")`, `patch("app.agents.nodes.statute.get_ollama_client")`, etc.).

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/integration/test_agent_routing.py -v`
Expected: All tests PASS. `graph.py` is now ~100 lines (down from 398).

- [ ] **Step 9: Commit**

```bash
git add backend/app/agents/
git commit -m "refactor(agents): split 398-line graph.py into per-node files

- Extract LegalResearchState to state.py
- Extract router_node to router.py
- Create nodes/ with statute.py, constitutional.py, case_law.py,
  comparison.py, synthesis.py (each < 80 lines)
- graph.py now imports from nodes/ and wires the graph (~100 lines)
- build_routing_map() used by all conditional edges — sequential
  specialist execution, then synthesis
- Fix routing: each specialist edge goes back to build_routing_map,
  not directly to synthesis"
```

---

## Step 3 — Citation Normalization at Synthesis Boundary

**Goal:** Implement hybrid citation format — domain-specific internally, generic `LegalCitation` at synthesis boundary.

### Task 3.1: Create citation_normalizer.py

**Files:**
- Create: `backend/app/agents/citation_normalizer.py`

- [ ] **Step 1: Write LegalCitation TypedDict and normalize function**

```python
# backend/app/agents/citation_normalizer.py
from typing import Literal, TypedDict, Any, Dict, List, Union

# Supported citation types
CitationType = Literal["statute", "constitutional", "case_law", "comparison"]


class LegalCitation(TypedDict):
    """Normalized citation format used at the synthesis boundary."""
    type: CitationType
    identifier: str        # Human-readable citation, e.g. "Employment Act, 1980, s 35"
    text: str            # Excerpt from the source
    metadata: Dict[str, Any]  # Domain-specific fields preserved


def normalize_statute_citation(citation: Dict[str, Any]) -> LegalCitation:
    """Transform statute citation format to LegalCitation."""
    return LegalCitation(
        type="statute",
        identifier=f"{citation.get('act', '')}, {citation.get('year', 'n.d.')}, s {citation.get('section', 'N/A')}",
        text=citation.get("excerpt", ""),
        metadata={
            "act": citation.get("act"),
            "year": citation.get("year"),
            "section": citation.get("section"),
            "related_provisions": citation.get("related_provisions", []),
        },
    )


def normalize_constitutional_citation(citation: Dict[str, Any]) -> LegalCitation:
    """Transform constitutional citation format to LegalCitation."""
    return LegalCitation(
        type="constitutional",
        identifier=f"Constitution of the Kingdom of Eswatini, 2005, s {citation.get('section', 'N/A')}",
        text=citation.get("excerpt", ""),
        metadata={
            "chapter": citation.get("chapter"),
            "section": citation.get("section"),
            "right": citation.get("right"),
            "related_constitutional_provisions": citation.get("related_constitutional_provisions", []),
        },
    )


def normalize_case_law_citation(citation: Dict[str, Any]) -> LegalCitation:
    """Transform case_law citation format to LegalCitation."""
    return LegalCitation(
        type="case_law",
        identifier=f"{citation.get('case_name', '')}, {citation.get('year', '')} {citation.get('court', '')}",
        text=citation.get("summary", citation.get("excerpt", "")),
        metadata={
            "case_name": citation.get("case_name"),
            "court": citation.get("court"),
            "year": citation.get("year"),
            "citation": citation.get("citation"),
            "precedential_value": citation.get("precedential_value"),
        },
    )


def normalize_comparison(comparison: Dict[str, Any]) -> List[LegalCitation]:
    """Transform comparison agent output to LegalCitation list.

    Comparison has no single canonical citation — it compares two provisions.
    We create two LegalCitations, one per provision.
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
        statute_result = agent_outputs["statute_result"]
        for citation in statute_result.get("citations", []):
            normalized.append(normalize_statute_citation(citation))

    if agent_outputs.get("constitutional_result"):
        constitutional_result = agent_outputs["constitutional_result"]
        for citation in constitutional_result.get("citations", []):
            normalized.append(normalize_constitutional_citation(citation))

    if agent_outputs.get("case_law_result"):
        case_law_result = agent_outputs["case_law_result"]
        for citation in case_law_result.get("citations", []):
            normalized.append(normalize_case_law_citation(citation))

    if agent_outputs.get("comparison_result"):
        comparison_result = agent_outputs["comparison_result"]
        for comparison in comparison_result.get("comparisons", []):
            normalized.extend(normalize_comparison(comparison))

    return normalized
```

- [ ] **Step 2: Write unit tests for citation_normalizer**

```python
# backend/tests/unit/test_citation_normalizer.py
import pytest
from app.agents.citation_normalizer import (
    normalize_statute_citation,
    normalize_constitutional_citation,
    normalize_case_law_citation,
    normalize_comparison,
    normalize_citations,
    LegalCitation,
)

def test_normalize_statute_citation():
    citation = {
        "act": "Employment Act",
        "year": 1980,
        "section": "35(1)(b)",
        "excerpt": "No employer shall terminate a contract of employment...",
        "related_provisions": ["Employment Act s 36"],
    }
    result = normalize_statute_citation(citation)
    assert result["type"] == "statute"
    assert result["identifier"] == "Employment Act, 1980, s 35(1)(b)"
    assert result["text"] == citation["excerpt"]
    assert result["metadata"]["act"] == "Employment Act"

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
    assert result["metadata"]["right"] == "Right to fair trial"

def test_normalize_case_law_citation():
    citation = {
        "case_name": "Smith v Jones",
        "court": "High Court",
        "year": 2010,
        "citation": " Civ 123",
        "summary": "Wrongful dismissal established...",
        "precedential_value": "HIGH",
    }
    result = normalize_case_law_citation(citation)
    assert result["type"] == "case_law"
    assert "Smith v Jones" in result["identifier"]
    assert result["metadata"]["precedential_value"] == "HIGH"

def test_normalize_comparison():
    comparison = {
        "provision_1": "Employment Act, 1980, s 35",
        "provision_2": "Industrial Relations Act, 2000, s 12",
        "relationship": "conflicting",
        "analysis": "The two provisions conflict on the definition of strike...",
    }
    result = normalize_comparison(comparison)
    assert len(result) == 2
    assert result[0]["type"] == "comparison"
    assert result[0]["identifier"] == "Employment Act, 1980, s 35"
    assert result[1]["identifier"] == "Industrial Relations Act, 2000, s 12"

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
    assert len(result) == 4  # 1 statute + 1 constitutional + 1 case_law + 2 from comparison
    types = [c["type"] for c in result]
    assert "statute" in types
    assert "constitutional" in types
    assert "case_law" in types
    assert "comparison" in types
```

- [ ] **Step 3: Run tests**

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/unit/test_citation_normalizer.py -v`
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/agents/citation_normalizer.py backend/tests/unit/test_citation_normalizer.py
git commit -m "feat(agents): add citation normalizer for synthesis boundary

- LegalCitation TypedDict: type, identifier, text, metadata
- normalize_statute_citation, normalize_constitutional_citation,
  normalize_case_law_citation, normalize_comparison,
  normalize_citations() — transforms all domain formats to LegalCitation[]
- Unit tests for all normalizer functions
- Synthesis agent receives homogeneous LegalCitation[] regardless
  of which specialists ran"
```

---

### Task 3.2: Integrate citation normalizer into synthesis_node

**Files:**
- Modify: `backend/app/agents/nodes/synthesis.py`

- [ ] **Step 1: Update synthesis_node to inject normalized_citations**

Add after the `all_results` construction and before sending to the LLM:

```python
from app.agents.citation_normalizer import normalize_citations

# ... inside synthesis_node, after building all_results ...
normalized_citations = normalize_citations(state)
normalized_citations_json = json.dumps(normalized_citations, indent=2)

synthesis_prompt = load_prompt("synthesis")
messages = [
    {"role": "system", "content": synthesis_prompt},
    {"role": "user", "content": (
        f"Original Query: {state['query']}\n\n"
        f"Specialist Agent Results:\n\n" + "\n\n".join(all_results) + "\n\n"
        f"Normalized Citations (for your references section):\n{normalized_citations_json}"
    )},
]
```

- [ ] **Step 2: Run tests**

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/ -v -k "routing or citation" --ignore=tests/e2e`
Expected: All routing + citation tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/nodes/synthesis.py
git commit -m "feat(synthesis): inject normalized_citations into synthesis prompt

- normalize_citations(state) called in synthesis_node before LLM call
- Synthesis agent receives homogeneous LegalCitation[] alongside
  raw domain outputs for richer reference section"
```

---

### Task 3.3: Update agent prompts to add normalized_citations field

**Files:**
- Modify: `backend/prompts/agents/statute.md`
- Modify: `backend/prompts/agents/constitutional.md`
- Modify: `backend/prompts/agents/case_law.md`
- Modify: `backend/prompts/agents/comparison.md`

For each prompt, add to the JSON output block:
```json
"normalized_citations": [
  {
    "type": "statute|constitutional|case_law|comparison",
    "identifier": "...",
    "text": "...",
    "metadata": {}
  }
]
```

For example, in statute.md, update the output format to:
```json
{
  "answer": "Your detailed legal analysis...",
  "citations": [{"act": "...", "year": 0, "section": "...", "excerpt": "..."}],
  "normalized_citations": [
    {
      "type": "statute",
      "identifier": "[Act Name], [Year], s [section]",
      "text": "[excerpt from citations above]",
      "metadata": {"act": "...", "year": "...", "section": "..."}
    }
  ],
  "confidence": "HIGH|MEDIUM|LOW",
  "caveats": "Any important limitations.",
  "related_provisions": ["Employment Act s 36", "..."]
}
```

- [ ] **Step 1: Commit each prompt update**

```bash
git add backend/prompts/agents/statute.md backend/prompts/agents/constitutional.md backend/prompts/agents/case_law.md backend/prompts/agents/comparison.md
git commit -m "feat(prompts): add normalized_citations field to all specialist agent outputs

- statute, constitutional, case_law, comparison prompts now include
  normalized_citations[] alongside their domain-specific citations
- Enables synthesis agent to receive homogeneous LegalCitation[]
  regardless of which specialists responded"
```

---

## Step 4 — Test Fixtures

**Goal:** Replace 5-line `conftest.py` with proper fixtures enabling real integration testing.

### Task 4.1: Build comprehensive conftest.py

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Write complete conftest.py with all fixtures**

```python
# backend/tests/conftest.py
import pytest
import uuid
import sys
import os
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.database import Base
from app.core.models import User
from app.core.security import create_access_token, hash_password


# ─── Database Fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db_engine():
    """SQLite in-memory engine for the test session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Session:
    """Per-test session with transaction rollback isolation."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ─── Auth Fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def test_user(db_session: Session) -> User:
    """Create a test user in the DB."""
    user = User(
        id=uuid.uuid4(),
        email="testuser@example.com",
        password_hash=hash_password("testpassword123"),
        full_name="Test User",
        role="researcher",
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """Create an admin user in the DB."""
    user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        password_hash=hash_password("adminpassword123"),
        full_name="Admin User",
        role="admin",
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_token(test_user: User) -> str:
    """Return a valid JWT access token for test_user."""
    return create_access_token(test_user.id, test_user.role)


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Return a valid JWT access token for admin_user."""
    return create_access_token(admin_user.id, admin_user.role)


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Headers dict with Bearer token for API calls."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Headers dict with Bearer token for admin API calls."""
    return {"Authorization": f"Bearer {admin_token}"}


# ─── Mock Ollama Fixture ──────────────────────────────────────────────────────

@pytest.fixture
def mock_ollama(monkeypatch):
    """Stub all Ollama LLM calls in agent tests."""
    async def mock_chat(messages, model):
        return {
            "message": {
                "content": '{"agents": ["STATUTE"], "reasoning": "test", "confidence": 0.9, "query_type": "test"}'
            }
        }

    from app.llm import ollama_client
    monkeypatch.setattr(ollama_client, "get_ollama_client", lambda: MagicMock(chat=mock_chat))
    yield mock_chat


# ─── App Client Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def app():
    """Import and return the FastAPI app instance."""
    from app.main import app as fastapi_app
    return fastapi_app


@pytest.fixture
def client(app) -> TestClient:
    """Synchronous test client for sync endpoint tests."""
    return TestClient(app)


@pytest.fixture
async def async_client(app) -> AsyncClient:
    """Async client for testing streaming endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 2: Verify pytest runs without conftest errors**

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest --collect-only`
Expected: Test collection succeeds with no conftest errors.

- [ ] **Step 3: Write integration tests using new fixtures**

```python
# backend/tests/integration/test_api_auth.py
import pytest
from app.core.security import verify_password

def test_login_success(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "testpassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401

def test_register(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "newpassword123",
            "full_name": "New User",
        },
    )
    assert response.status_code == 200
    assert response.json()["message"] == "User registered successfully"

def test_me_endpoint(auth_headers, test_user, client):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testuser@example.com"
    assert data["role"] == "researcher"
```

```python
# backend/tests/integration/test_api_chat.py
import pytest

@pytest.mark.asyncio
async def test_chat_sync_with_auth(async_client, auth_headers, mock_ollama):
    response = await async_client.post(
        "/api/v1/chat/sync",
        headers=auth_headers,
        json={"query": "What does section 35 of Employment Act say?"},
    )
    # May return 200 or 500 if Ollama not available — key is auth passed
    assert response.status_code in (200, 500)

def test_chat_sync_unauthorized(client):
    response = client.post(
        "/api/v1/chat/sync",
        json={"query": "Test query"},
    )
    assert response.status_code == 401
```

- [ ] **Step 4: Run all tests**

Run: `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/ -v --ignore=tests/e2e`
Expected: Tests run without conftest errors. Some may fail due to missing Ollama — that's expected.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/conftest.py backend/tests/integration/test_api_auth.py backend/tests/integration/test_api_chat.py
git commit -m "test(fixtures): add comprehensive conftest.py with DB, auth, and Ollama mocks

- db_engine (SQLite in-memory, session-scoped)
- db_session (per-test transactional rollback)
- test_user, admin_user (DB fixtures)
- auth_token, admin_token, auth_headers, admin_headers
- mock_ollama (patches get_ollama_client)
- app, client, async_client (FastAPI test clients)
- Add test_api_auth.py (login, register, me endpoints)
- Add test_api_chat.py (chat sync auth checks)"
```

---

## Step 5 — Frontend API Consolidation

**Goal:** Replace `lib/api.ts` (355L) and `lib/integration/chat-service.ts` (271L) with per-domain modules. Align auth on HTTP-only cookies.

### Task 5.1: Create frontend/lib/api/ directory with per-domain modules

**Files:**
- Create: `frontend/lib/api/auth.ts`
- Create: `frontend/lib/api/chat.ts`
- Create: `frontend/lib/api/documents.ts`
- Create: `frontend/lib/api/health.ts`
- Create: `frontend/lib/api/admin.ts`
- Create: `frontend/lib/api/index.ts`

- [ ] **Step 1: Create auth.ts**

```typescript
// frontend/lib/api/auth.ts
import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name?: string
  organisation?: string
}

export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'researcher' | 'public'
  organisation?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // Send HTTP-only cookie
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Login failed: ${res.status}`)
    }
    return res.json()
  },

  register: async (data: RegisterRequest): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Registration failed: ${res.status}`)
    }
    return res.json()
  },

  me: async (): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      credentials: 'include',
    })
    if (!res.ok) {
      throw new Error(`Failed to get user: ${res.status}`)
    }
    return res.json()
  },
}
```

- [ ] **Step 2: Create chat.ts**

```typescript
// frontend/lib/api/chat.ts
import { parseSSEStream, SSEEvent, Source } from './index'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ChatFilters {
  doc_type?: string[]
  year_min?: number
  year_max?: number
  ministry?: string
  status?: string
}

export interface ChatSyncRequest {
  query: string
  filters?: Record<string, unknown>
}

export interface ChatSyncResponse {
  final_answer: string
  sources: Source[]
  confidence: string
  disclaimer: string
}

export interface Session {
  id: string
  session_title?: string
  model_used?: string
  created_at: string
  messages?: unknown[]
}

export const chatApi = {
  stream: (
    query: string,
    filters?: ChatFilters,
    onEvent?: (event: SSEEvent) => void,
    onError?: (error: Error) => void
  ) => {
    const params = new URLSearchParams({ query })
    if (filters?.doc_type?.length) {
      filters.doc_type.forEach((dt) => params.append('doc_type', dt))
    }
    if (filters?.year_min) params.set('year_min', String(filters.year_min))
    if (filters?.year_max) params.set('year_max', String(filters.year_max))
    if (filters?.ministry) params.set('ministry', filters.ministry)
    if (filters?.status) params.set('status', filters.status)

    const cookieStore = cookies()
    const token = cookieStore.get('elri_auth_token')?.value

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return fetch(`${API_BASE_URL}/api/v1/chat/stream?${params}`, {
      headers,
    })
  },

  sync: async (data: ChatSyncRequest): Promise<ChatSyncResponse> => {
    const cookieStore = cookies()
    const token = cookieStore.get('elri_auth_token')?.value

    const res = await fetch(`${API_BASE_URL}/api/v1/chat/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Chat sync failed: ${res.status}`)
    }
    return res.json()
  },

  sessions: async (page = 1): Promise<{ sessions: Session[]; total: number }> => {
    const cookieStore = cookies()
    const token = cookieStore.get('elri_auth_token')?.value

    const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions?page=${page}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
    return res.json()
  },

  session: async (id: string): Promise<Session> => {
    const cookieStore = cookies()
    const token = cookieStore.get('elri_auth_token')?.value

    const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${id}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
    return res.json()
  },
}
```

- [ ] **Step 3: Create documents.ts, health.ts, admin.ts, index.ts**

`documents.ts` (list, get, ingest, ingestJobs), `health.ts` (models, status), `admin.ts` (pullModel) — each follows the same pattern as `chat.ts`: credentials: 'include', Authorization header from cookie.

**Create `frontend/lib/api/utils.ts`** for shared types and utilities (moved from original `api.ts`):

```typescript
// frontend/lib/api/utils.ts
import { parseSSEStream as _parseSSEStream, SSEEvent, Source, ApiError } from '../api'
export const parseSSEStream = _parseSSEStream
export { SSEEvent, Source, ApiError }
```

> This imports from the original `api.ts` temporarily, then re-exports. After `api.ts` is deleted, inline the `parseSSEStream` function directly in `utils.ts` (it's ~40 lines of pure TypeScript with no external dependencies).

Then `index.ts` re-exports everything:

```typescript
// frontend/lib/api/index.ts
export { authApi, type LoginRequest, type RegisterRequest, type User, type AuthResponse } from './auth'
export { chatApi, type ChatFilters, type ChatSyncRequest, type ChatSyncResponse, type Session } from './chat'
export { documentsApi, type Document, type DocumentChunk, type CorpusStats, type IngestionJob } from './documents'
export { healthApi, type HealthStatus } from './health'
export { adminApi } from './admin'
export { parseSSEStream, SSEEvent, Source, ApiError } from './utils'
```

- [ ] **Step 4: Commit partial progress**

```bash
git add frontend/lib/api/
git commit -m "feat(api): create frontend/lib/api/ with per-domain modules

- auth.ts, chat.ts, documents.ts, health.ts, admin.ts
- All use credentials: 'include' for HTTP-only cookie auth
- parseSSEStream, SSEEvent, Source moved to api/utils.ts
- Re-exported from api/index.ts"
```

---

### Task 5.2: Update lib/auth.ts to use HTTP-only cookies

**Files:**
- Modify: `frontend/lib/auth.ts`

- [ ] **Step 1: Replace localStorage with HTTP-only cookie access**

```typescript
// frontend/lib/auth.ts — REWRITTEN to use HTTP-only cookies
import { cookies } from 'next/headers'
import { decodeJwt, JWTPayload } from 'jose'

export interface UserJWTPayload extends JWTPayload {
  sub: string
  role: 'admin' | 'researcher' | 'public'
  exp?: number
  iat?: number
}

const COOKIE_NAME = 'elri_auth_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    // Server-side: read from HTTP-only cookie
    return cookies().get(COOKIE_NAME)?.value ?? null
  }
  // Client-side: read from HTTP-only cookie (not localStorage)
  const match = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_NAME}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

export function setToken(token: string): void {
  // Token is set by the server via Set-Cookie header on login
  // Client-side only needs to trigger a page reload
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') {
    cookies().delete(COOKIE_NAME)
  } else {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`
    window.location.reload()
  }
}

export function getUser(): UserJWTPayload | null {
  const token = getToken()
  if (!token) return null
  try {
    const payload = decodeJwt(token) as UserJWTPayload
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      clearToken()
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null
}

export function isAdmin(): boolean {
  return getUser()?.role === 'admin'
}

export function isResearcher(): boolean {
  const role = getUser()?.role
  return role === 'researcher' || role === 'admin'
}

export function getRole(): 'admin' | 'researcher' | 'public' | null {
  return getUser()?.role ?? null
}

export function getUserId(): string | null {
  return getUser()?.sub ?? null
}

export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true
  try {
    const payload = decodeJwt(token) as UserJWTPayload
    if (!payload.exp) return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}
```

- [ ] **Step 2: Update frontend/middleware.ts to read from same cookie**

`middleware.ts` already reads from `elri_auth_token` cookie — no changes needed there.

- [ ] **Step 3: Update hooks that call API to use new modules**

Review `frontend/lib/hooks/useStreamingChat.ts`, `frontend/components/chat/ChatInterface.tsx`, and any other files that import from `lib/api.ts`. Update imports to use the new `lib/api/` modules. For example:

```typescript
// Before
import { api } from '@/lib/api'

// After
import { chatApi } from '@/lib/api/chat'
```

- [ ] **Step 4: Run frontend tests**

Run: `cd /c/Users/sourc/Downloads/ELRS/frontend && npm test`
Expected: All tests PASS. If tests fail due to auth changes, update test mocks.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/auth.ts frontend/middleware.ts frontend/lib/api/ frontend/components/ frontend/lib/hooks/
git commit -m "refactor(frontend): replace localStorage auth with HTTP-only cookies

- lib/auth.ts rewritten to read elri_auth_token from HTTP-only cookie
  via next/headers cookies() — not localStorage
- middleware.ts already uses cookie — no changes needed
- All API calls use credentials: 'include' for cookie auth
- Components and hooks updated to import from lib/api/"
```

---

## Verification

After each step:
1. `cd /c/Users/sourc/Downloads/ELRS/backend && python -m pytest tests/ -v --ignore=tests/e2e`
2. `cd /c/Users/sourc/Downloads/ELRS/frontend && npm test`

After all steps complete:
- All 4 routing tests pass (statute, constitutional, case_law, comparison all reachable)
- `graph.py` ≤ 150 lines
- Citation normalizer tests pass
- Frontend tests pass
- No `localStorage.getItem('elri_auth_token')` remaining in auth flow
