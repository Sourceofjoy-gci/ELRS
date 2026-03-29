# ELRI Technical Debt Refactoring — Design

**Date:** 2026-03-29
**Status:** Approved
**Approach:** Routing-First (Incremental)

---

## 1. Problem Statement

The ELRI codebase has accumulated technical debt across multiple layers:

1. **Critical bug**: LangGraph conditional edges only route to `statute_node` or `synthesis_node`. Constitutional, case_law, and comparison nodes are unreachable for multi-topic queries.
2. **Monolithic agent graph**: `backend/app/agents/graph.py` (398 lines) is hard to extend and test.
3. **Inconsistent citation formats**: Each specialist agent uses a different output schema; synthesis must normalize five different structures.
4. **Minimal test infrastructure**: `tests/conftest.py` is 5 lines with no fixtures.
5. **Frontend API duplication**: `lib/api.ts` and `lib/integration/chat-service.ts` overlap; auth token storage is inconsistent between `middleware.ts` and `lib/auth.ts`.

---

## 2. Goals

1. All five agents (constitutional, case_law, comparison, statute, synthesis) are reachable from the router.
2. Consistent citation handling: domain-specific formats internally, generic `LegalCitation` at the synthesis boundary.
3. Test fixtures enable proper integration testing.
4. Frontend API layer is consolidated with a single auth token strategy.

---

## 3. Approach: Routing-First (Incremental)

Five sequential steps — each is deployable after completion:

### Step 1 — Fix Critical Routing Bug (Standalone Patch)
**Files changed:** `backend/app/agents/graph.py`

Fix `add_conditional_edges` to route to all specialist nodes based on `routing_decision`, not just statute. The router node sets `routing_decision` as a list of agent types to invoke. Each specialist node is reachable. No architectural changes.

```python
# Before (broken): routes only to statute or synthesis
add_conditional_edges("router", {
    "statute": "statute_node",
    "END": "synthesis_node"
}, routing_logic)

# After (fixed): routes to any specialist, synthesis after all complete
add_conditional_edges("router", {
    "statute": "statute_node",
    "constitutional": "constitutional_node",
    "case_law": "case_law_node",
    "comparison": "comparison_node",
    "END": "synthesis_node"
}, routing_logic)
```

**Exit criterion:** Agent routing tests pass for all four specialist types.

---

### Step 2 — Split Agent Graph into Per-Node Files
**Files changed:** New `backend/app/agents/nodes/` directory; `graph.py` refactored

```
backend/app/agents/
  __init__.py
  state.py               # LegalResearchState schema (moved from graph.py)
  router.py              # router_node function (moved from graph.py)
  citation_normalizer.py # normalize_citations() — Step 3 addition
  nodes/
    __init__.py
    statute.py           # statute_node + _call_statute_agent()
    constitutional.py
    case_law.py
    comparison.py
    synthesis.py        # synthesis_node + _call_synthesis_agent()
  graph.py               # Imports from nodes/ and wires the graph
```

Each node file is < 80 lines. `_call_agent()` helper stays in each file to keep nodes self-contained.

**Exit criterion:** `graph.py` reduced to ≤150 lines (from 398). All existing agent routing tests still pass.

---

### Step 3 — Citation Normalization at Synthesis Boundary
**Files changed:** `backend/app/agents/state.py`, `backend/app/agents/nodes/synthesis.py`, `backend/prompts/agents/*.md`

Domain-specific citation formats are preserved in each specialist's output. The synthesis node normalizes before passing to synthesis agent:

```python
# backend/app/agents/citation_normalizer.py
class LegalCitation(TypedDict):
    type: Literal["statute", "constitutional", "case_law", "comparison"]
    identifier: str          # e.g., "Act 10 of 2020 s.5" or "Smith v. Jones"
    text: str                # quoted excerpt
    metadata: dict           # domain-specific fields preserved

def normalize_citations(agent_outputs: dict) -> list[LegalCitation]:
    """Transform each domain citation format into LegalCitation."""
    ...
```

Each agent prompt gains a `normalized_citations` field — agents produce it alongside their domain output, so synthesis gets both the rich domain format and the generic normalized form.

**Exit criterion:** Synthesis agent receives homogeneous `LegalCitation[]` input regardless of which specialists ran.

---

### Step 4 — Test Fixtures
**Files changed:** `backend/tests/conftest.py`, new fixture files

```python
# backend/tests/conftest.py
@pytest.fixture(scope="session")
def db_engine():
    """SQLite in-memory DB for tests."""
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    yield engine
    engine.dispose()

@pytest.fixture
def db_session(db_engine):
    """Transactional rollback per test."""
    with Session(db_engine) as session:
        begin_nested = session.begin_nested()
        yield session
        session.rollback()

@pytest.fixture
def auth_token(db_session):
    """Create test user and return JWT token."""
    user = create_test_user(session)
    token = create_access_token(user.id, user.role)
    return token

@pytest.fixture
def mock_ollama(monkeypatch):
    """Stub Ollama responses for agent tests."""
    def mock_generate(*args, **kwargs):
        return Mock(response="test response", citations=[])
    monkeypatch.setattr(ollama_client, "generate", mock_generate)
```

Integration tests use real API calls against the test DB; unit tests mock at the Ollama layer.

**Exit criterion:** `pytest` runs without conftest errors; auth, chat, and routing integration tests use real DB.

---

### Step 5 — Frontend API Consolidation
**Files changed:** `frontend/lib/api/`, `frontend/lib/auth.ts`, `frontend/middleware.ts`

```
frontend/lib/api/
  index.ts           # Re-exports all API modules
  auth.ts            # /register, /login, /me
  chat.ts            # /chat/stream, /chat/sync, /chat/sessions
  documents.ts       # /documents/*
  health.ts          # /health
  admin.ts           # /admin/*
```

`lib/api.ts` and `lib/integration/chat-service.ts` are replaced by this structure. All API calls use `/api/v1/*` endpoint paths (matching backend versioning in Breaking Changes above).

**Auth token strategy:** HTTP-only cookies via Next.js `cookies()` API — both `middleware.ts` and `lib/auth.ts` use this. LocalStorage token removed.

**Exit criterion:** `lib/api.ts` and `lib/integration/chat-service.ts` deleted; no remaining localStorage token access in auth flow.

---

## 4. Scalability Considerations

- **Agent graph splitting** makes it trivial to add new specialist agents (new file in `nodes/`, register in `graph.py`).
- **Citation normalizer** is a single transformation point — adding a new citation type requires only a new normalizer branch, not changes to synthesis.
- **Test fixtures** enable performance testing with realistic data at scale.
- **Frontend API split** into per-domain modules prevents merge conflicts and allows independent deployment.

---

## 5. Breaking Changes

- **API versioning**: New endpoints at `/api/v1/*` (parallel with existing). Old endpoints (`/api/*`) remain functional but deprecated. Frontend migrates to v1 endpoints in Step 5.
- **Citation format**: Synthesis output gains a `normalized_citations` field alongside existing fields. No fields removed in this phase.
- **Auth tokens**: HTTP-only cookie replaces localStorage. Frontend auth flow updated in Step 5.

---

## 6. Out of Scope (Phase 1)

- Adding new specialist agents
- Changing embedding or reranking models
- Docker/infrastructure changes (resource limits, health checks)
- Changing the retrieval chunking strategy
- Adding Redis caching

---

## 7. Verification

After each step:
1. Run existing tests: `pytest backend/tests/ -v`
2. Run frontend tests: `cd frontend && npm test`
3. Manual smoke test: query that should trigger each specialist agent type

After all steps:
1. All agents reachable for multi-topic queries (verified via agent trace)
2. Citation normalizer tested with all five domain formats
3. Full integration test suite passes
