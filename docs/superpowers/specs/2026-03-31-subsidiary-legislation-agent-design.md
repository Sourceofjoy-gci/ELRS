# Add Subsidiary Legislation Specialist Agent — Design

**Date:** 2026-03-31
**Status:** Approved
**Parent:** [2026-03-29-elri-refactoring-design.md](./2026-03-29-elri-refactoring-design.md)

---

## 1. Goal

Add a `SUBSIDIARY` specialist agent for SIs (Statutory Instruments), regulations, rules, and orders. It will be reachable from the router alongside the four existing specialists (statute, constitutional, case_law, comparison).

---

## 2. Files

| File | Change |
|---|---|
| `backend/prompts/agents/subsidiary.md` | Create — specialist prompt |
| `backend/prompts/agents/router.md` | Modify — add SUBSIDIARY to available agents |
| `backend/app/agents/graph.py` | Modify — state fields, node function, routing, synthesis |

---

## 3. Prompt — `backend/prompts/agents/subsidiary.md`

```markdown
You are a specialist in subsidiary legislation of the Kingdom of Eswatini.
You have access to retrieved SIs, regulations, and rules in the context below.

## Citation Format
[SI Number] of [Year]
Example: SI 45 of 2000, SI 12 of 2015 reg 3

## Rules
1. Cite every provision using the SI format above.
2. Note which primary Act the SI was made under.
3. Note whether in force, amended, or revoked.
4. Distinguish black-letter law from practical application.
5. Flag gaps or ambiguities.
6. Base your answer ONLY on the provided context. If context is insufficient, say so.
7. NEVER fabricate citations or invent provisions.

## Output Format (JSON)
{
  "answer": "Your detailed legal analysis...",
  "citations": [{"si": "...", "year": 0, "provision": "...", "excerpt": "..."}],
  "confidence": "HIGH|MEDIUM|LOW",
  "caveats": "Any important limitations.",
  "related_provisions": ["SI 45 of 2000 reg 3", "..."]
}
```

---

## 4. Router — `backend/prompts/agents/router.md`

Add to the Available Specialist Agents list:

```markdown
- STATUTE        → Acts of Parliament, their sections, provisions, amendments
- SUBSIDIARY     → SIs, Statutory Instruments, regulations, rules, orders
- CONSTITUTIONAL → Rights, freedoms, constitutional supremacy, 2005 Constitution
- CASE_LAW       → Court judgments, precedents, High Court and Supreme Court
- COMPARISON     → Compare two or more laws, contradictions, legislative history
- GENERAL        → Definitions, explanations, introductory questions
```

---

## 5. State — `backend/app/agents/graph.py`

Add two fields to `LegalResearchState`:

```python
subsidiary_result: Optional[Dict[str, Any]]
```

The `*_trace` fields are not stored in state — they are ephemeral per specialist call and merged into `agent_trace` at synthesis time.

---

## 6. Node — `backend/app/agents/graph.py`

```python
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
```

No special retrieval filter — uses the same corpus as statute via `HybridRetriever`.

---

## 7. Routing — `backend/app/agents/graph.py`

In `route_from_router`, add:

```python
if "SUBSIDIARY" in agents:
    sends.append(Send("subsidiary", specialist_state))
```

In `create_legal_research_graph`:

```python
workflow.add_node("subsidiary", subsidiary_node)
workflow.add_edge("subsidiary", "synthesis")
```

---

## 8. Synthesis — `backend/app/agents/graph.py`

In `synthesis_node`, add to the agent_trace loop:

```python
("subsidiary", "subsidiary_trace"),
```

Add to `all_results`:

```python
if state.get("subsidiary_result"):
    all_results.append(f"SUBSIDIARY LEGISLATION ANALYSIS:\n{json.dumps(state['subsidiary_result'], indent=2)}")
```

---

## 9. Verification

1. Write test: routing returns `["SUBSIDIARY"]` → only `subsidiary_result` set, others None
2. Write test: routing returns `["STATUTE", "SUBSIDIARY"]` → both results set
3. All 14 routing tests pass
4. Full `pytest backend/tests/ -v` — no regressions

---

## 10. Out of Scope

- Citation normalization (Step 3 of parent plan)
- Agent graph splitting into per-node files (Step 2)
- Test fixtures (Step 4)
- Frontend API consolidation (Step 5)
