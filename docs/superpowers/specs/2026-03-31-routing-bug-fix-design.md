# Routing Bug Fix — Design

**Date:** 2026-03-31
**Status:** Approved
**Parent:** [2026-03-29-elri-refactoring-design.md](./2026-03-29-elri-refactoring-design.md) (Step 1)

---

## 1. Problem

`backend/app/agents/graph.py:356-360` — `add_conditional_edges` uses a broken pattern:

```python
workflow.add_conditional_edges(
    "router",
    should_run_agent("STATUTE"),   # returns a function, not a routing key
    {"statute": "statute", "__end__": "synthesis"}
)
```

`should_run_agent("STATUTE")` returns a function that returns `True`/`False`. LangGraph looks for `"True"` or `"False"` as keys in the mapping — neither exists, so the graph breaks.

Even if that were fixed, the design only supported single-agent routing (`STATUTE` or `END`), but the router can return multiple agents simultaneously (e.g., `["STATUTE", "CONSTITUTIONAL"]`).

**Result:** `constitutional_node`, `case_law_node`, and `comparison_node` are unreachable for all queries.

---

## 2. Fix

### 2.1 Routing Function — `route_from_router`

Replace `should_run_agent` with a function that returns a single routing key. All specialist nodes receive the state and self-check.

```python
def route_from_router(state: LegalResearchState) -> str:
    """Router unconditionally routes to all specialists; each self-checks."""
    return "all_specialists"
```

### 2.2 Graph Wiring — `create_legal_research_graph`

**Before:**

```python
workflow.add_conditional_edges(
    "router",
    should_run_agent("STATUTE"),
    {"statute": "statute", "__end__": "synthesis"}
)
workflow.add_edge("statute", "synthesis")
workflow.add_edge("constitutional", "synthesis")
workflow.add_edge("case_law", "synthesis")
workflow.add_edge("comparison", "synthesis")
```

**After:**

```python
workflow.add_conditional_edges(
    "router",
    route_from_router,
    {"all_specialists": ["statute", "constitutional", "case_law", "comparison"]}
)
workflow.add_edge("statute", "synthesis")
workflow.add_edge("constitutional", "synthesis")
workflow.add_edge("case_law", "synthesis")
workflow.add_edge("comparison", "synthesis")
```

LangGraph interprets a **list** of node names as fan-out to all of them in parallel. Each specialist node already has an internal self-check (`if "AGENT" not in routing_decision.get("agents", []): return state`) so they run or skip appropriately.

`should_run_agent` is kept (unused) for reference but can be removed in Step 2.

### 2.3 Test Additions — `backend/tests/integration/test_agent_routing.py`

Add 5 async graph invocation tests:

| Test | Routing Decision | Expected Behavior |
|---|---|---|
| `test_routes_to_statute_only` | `["STATUTE"]` | statute_result set, others None |
| `test_routes_to_constitutional_only` | `["CONSTITUTIONAL"]` | constitutional_result set, others None |
| `test_routes_to_case_law_only` | `["CASE_LAW"]` | case_law_result set, others None |
| `test_routes_to_comparison_only` | `["COMPARISON"]` | comparison_result set, others None |
| `test_routes_to_multiple_agents` | `["STATUTE", "CONSTITUTIONAL"]` | both results set, others None |

Each test mocks `ollama.chat` and `_retrieve_chunks` to avoid real DB/LLM calls.

---

## 3. Files Changed

| File | Change |
|---|---|
| `backend/app/agents/graph.py` | Replace `should_run_agent` routing with `route_from_router`; update `add_conditional_edges` mapping |
| `backend/tests/integration/test_agent_routing.py` | Add 5 async tests for actual graph invocation |

---

## 4. Verification

1. `pytest backend/tests/integration/test_agent_routing.py -v` — all 5 new tests pass
2. `pytest backend/tests/ -v` — no regressions
3. Manual: multi-topic query triggers all relevant specialist nodes (verified via agent_trace)

---

## 5. Out of Scope

- Agent graph splitting (Step 2 of parent plan)
- Citation normalization (Step 3)
- Test fixtures (Step 4)
- Frontend API consolidation (Step 5)
