# ELRI — Eswatini Legal Research Intelligence
## Product Requirements Document v1.0

> **Inspired by Agent Zero** — hierarchical multi-agent architecture, Docker-native runtime,
> fully local open-source LLMs, transparent prompt-driven behaviour, persistent vector memory.
> Reference: [github.com/agent0ai/agent-zero](https://github.com/agent0ai/agent-zero)

---

```
Classification  : DEVELOPMENT SPECIFICATION
Status          : FOR IMPLEMENTATION
Version         : 1.0.0
Deployment      : Docker Compose — Single-command start
AI Runtime      : 100 % Local — No external API calls
Data Residency  : Air-gapped — All data stays on host
Inspired by     : Agent Zero (agent0ai/agent-zero)
Motto           : Siyinqaba — We are the fortress.
```

---

## Table of Contents

1. [Mission Statement](#1-mission-statement)
2. [Agent Zero Architecture Alignment](#2-agent-zero-architecture-alignment)
3. [System Overview](#3-system-overview)
4. [Local AI Model Stack](#4-local-ai-model-stack)
5. [Docker Services Catalogue](#5-docker-services-catalogue)
6. [Back-End Tasks — B Series](#6-back-end-tasks--b-series)
7. [Front-End Tasks — F Series](#7-front-end-tasks--f-series)
8. [Testing Tasks — T Series](#8-testing-tasks--t-series)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Hardware Requirements](#10-hardware-requirements)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Glossary](#12-glossary)

---

## 1. Mission Statement

Build a **production-ready, fully air-gapped, multi-agent AI legal research platform**
for the Kingdom of Eswatini's legislative framework. The system must allow legal
professionals, judicial officers, government ministries, academics, and citizens to query
Acts of Parliament, statutory instruments, constitutional provisions, and case law using
natural language — with every computation running on local hardware inside Docker containers.

**Zero cloud dependencies. Zero API keys. Zero data leaving the server.**

The architecture mirrors Agent Zero's design philosophy:

- **Hierarchical agents** — a Router Agent delegates to specialist sub-agents exactly as
  Agent Zero's superior-subordinate hierarchy delegates tasks.
- **Persistent vector memory** — FAISS / pgvector stores learned patterns, retrieved chunks,
  and session context across conversations, mirroring Agent Zero's memory system.
- **Prompt-driven behaviour** — every agent's reasoning is defined in Markdown prompt files,
  not hard-coded logic, following Agent Zero's `prompts/` convention.
- **Docker-native runtime** — the entire stack runs inside containers with a single
  `docker compose up`, identical to Agent Zero's deployment model.
- **LiteLLM-compatible local LLMs** — all LLM calls route through Ollama's OpenAI-compatible
  API, matching Agent Zero's LiteLLM abstraction layer.
- **Tool-based extensibility** — each agent invokes typed tools (retrieval, reranking,
  citation formatting) rather than embedding logic directly, following Agent Zero's
  `python/tools/` pattern.

---

## 2. Agent Zero Architecture Alignment

| Agent Zero Concept | ELRI Implementation |
|---|---|
| `Agent` class — continuous decision loop | `LegalAgent` base class — retrieve → reason → generate loop |
| `AgentContext` — state and lifecycle manager | `ResearchSession` — query state, agent trace, source list |
| Superior / subordinate hierarchy | Router Agent → Specialist Agents → Synthesis Agent |
| `prompts/` directory — Markdown prompt files | `prompts/agents/` — one `.md` file per agent role |
| `python/helpers/memory.py` — FAISS vector store | `app/retrieval/` — pgvector + ParadeDB hybrid store |
| `python/tools/` — extensible tool base class | `app/tools/` — retrieval, reranker, citation, formatter |
| `models.py` — LiteLLM wrapper for 100+ providers | `app/llm/ollama_client.py` — Ollama OpenAI-compat client |
| `run_ui.py` — Flask + Socket.IO real-time server | FastAPI + SSE streaming endpoint |
| Web UI — Alpine.js reactive, no build step | Next.js 14 App Router + shadcn/ui |
| Docker runtime under `/a0` in container | Docker Compose — all services on `elri_network` bridge |
| `knowledge/` — persistent learning base | `legal_documents` + `document_chunks` PostgreSQL tables |
| Settings page — model selection, API keys | Admin UI — Ollama model manager, TEI health panel |

---

## 3. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  ·  Next.js 14  ·  Port 3000                                  │
│  Chat UI · Document Library · Admin Panel · Agent Thinking Panel        │
├─────────────────────────────────────────────────────────────────────────┤
│  BACKEND API  ·  FastAPI  ·  Port 8000                                  │
│  JWT Auth · SSE Streaming · REST Endpoints · LangGraph Orchestration    │
├───────────────┬────────────────────────────────┬────────────────────────┤
│  AGENT LAYER  │  RETRIEVAL LAYER               │  AUTH / RBAC           │
│               │                                │                        │
│  Router       │  HybridRetriever               │  JWT Middleware        │
│    ↓           │    ├── VectorStore (pgvector)  │  Role: public          │
│  Statute      │    ├── BM25Store (ParadeDB)     │  Role: researcher      │
│  Constitutional│   └── Reranker (TEI)           │  Role: admin           │
│  Case Law     │  RRF Fusion (k=60)             │                        │
│  Comparison   │  Top-8 ranked chunks           │                        │
│    ↓           │                                │                        │
│  Synthesis    │                                │                        │
├───────────────┴────────────────────────────────┴────────────────────────┤
│  LOCAL AI SERVICES  (Docker Hub images — zero cloud calls)              │
│                                                                         │
│  ollama/ollama:latest          →  Mistral 7B · Llama 3.1 8B · Phi-3    │
│  huggingface/tei:cpu-1.5       →  nomic-embed-text-v1.5  (port 8080)   │
│  huggingface/tei:cpu-1.5       →  ms-marco-MiniLM-L-6-v2 (port 8081)  │
├─────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                             │
│  paradedb/paradedb  ·  redis:7-alpine  ·  minio/minio  ·  langfuse     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Hierarchy (Agent Zero pattern)

```
User Query
    │
    ▼
┌─────────────┐   delegates   ┌──────────────────────┐
│ Router Agent│ ────────────► │ Statute Agent        │  mistral:7b
│ (phi3:mini) │               │ Constitutional Agent  │  mistral:7b
│             │               │ Case Law Agent        │  mistral:7b
│             │               │ Comparison Agent      │  mistral:7b
└─────────────┘               └──────────┬───────────┘
                                         │  structured outputs
                                         ▼
                              ┌──────────────────────┐
                              │ Synthesis Agent       │  llama3.1:8b
                              │ (final response)      │
                              └──────────────────────┘
```

---

## 4. Local AI Model Stack

> All models run inside Docker containers. No external inference API is ever called.
> Internet access is only required on **first run** to pull models into Docker volumes.

| Role | Model | Docker Image / Pull Command | Disk | VRAM (Q4) |
|---|---|---|---|---|
| Primary LLM — legal reasoning | `mistral:7b-instruct-q4_K_M` | `ollama pull mistral:7b-instruct-q4_K_M` | 4.1 GB | 6 GB |
| Synthesis LLM — 128k context | `llama3.1:8b-instruct-q4_K_M` | `ollama pull llama3.1:8b-instruct-q4_K_M` | 4.7 GB | 8 GB |
| Router LLM — fast classification | `phi3:mini-instruct-q4` | `ollama pull phi3:mini-instruct-q4` | 2.2 GB | 3 GB |
| Embedding model — 768-dim | `nomic-ai/nomic-embed-text-v1.5` | TEI image: `ghcr.io/huggingface/text-embeddings-inference:cpu-1.5` | 274 MB | — |
| Reranker — cross-encoder | `cross-encoder/ms-marco-MiniLM-L-6-v2` | TEI image (reranker mode) | 90 MB | — |

**Total first-pull disk:** ≈ 11.4 GB  
**Ollama API:** OpenAI-compatible at `http://ollama:11434` — drop-in replacement, no SDK changes needed.

---

## 5. Docker Services Catalogue

```yaml
# Services defined in infra/docker-compose.yml
# Start with: docker compose up -d
# CPU override: docker compose -f docker-compose.yml -f docker-compose.cpu.yml up -d
```

| Service Name | Docker Hub Image | Internal Port | Description |
|---|---|---|---|
| `ollama` | `ollama/ollama:latest` | 11434 | Serves Mistral 7B, Llama 3.1 8B, Phi-3 Mini via OpenAI-compat REST |
| `tei-embeddings` | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.5` | 8080 | Hosts nomic-embed-text-v1.5; batch embedding for ingestion + queries |
| `tei-reranker` | `ghcr.io/huggingface/text-embeddings-inference:cpu-1.5` | 8081 | Hosts ms-marco cross-encoder; reranks top-30 hybrid candidates |
| `postgres` | `paradedb/paradedb:latest` | 5432 | PostgreSQL 16 + pgvector (ANN) + pg_search (BM25) pre-installed |
| `redis` | `redis:7-alpine` | 6379 | Celery broker for async ingestion jobs; session caching |
| `minio` | `minio/minio:latest` | 9000 / 9001 | S3-compatible store for raw PDFs, DOCX files, ingestion logs |
| `backend` | custom build | 8000 | FastAPI + LangGraph; JWT auth; SSE streaming; REST API |
| `ingestion-worker` | custom build | — | Celery: PDF extract → chunk → embed → index |
| `frontend` | custom build | 3000 | Next.js 14; chat UI; document library; admin panel |
| `langfuse` | `langfuse/langfuse:latest` | 3001 | Self-hosted LLM observability: traces, token counts, latency |

**All services communicate on the internal `elri_network` Docker bridge.  
No service port needs public exposure except frontend (3000) and backend (8000).**

---

## 6. Back-End Tasks — B Series

> Convention: Each task is **self-contained** and **independently executable** by an AI agent.
> Dependencies are listed explicitly. All paths are relative to the repository root.
> Acceptance criteria are binary — the task either passes or fails.

---

### B1 — Infrastructure Bootstrap

**Priority:** Critical — must complete before all other B tasks.  
**Assignee:** DevOps Agent  
**Dependencies:** None

#### Objective
Create the complete Docker Compose infrastructure that launches all ten services from
Docker Hub images with a single command.

#### Deliverables

1. **`infra/docker-compose.yml`** — full GPU-enabled stack:
   - Services: `ollama`, `tei-embeddings`, `tei-reranker`, `postgres`, `redis`, `minio`,
     `backend`, `ingestion-worker`, `frontend`, `langfuse`
   - All services on `elri_network` bridge network
   - All services with `restart: unless-stopped`
   - All services with `healthcheck` blocks using appropriate commands
   - Named volumes: `ollama_models`, `tei_embed_models`, `tei_rerank_models`,
     `postgres_data`, `redis_data`, `minio_data`
   - `ollama` service must include `runtime: nvidia` and `NVIDIA_VISIBLE_DEVICES=all`
   - `OLLAMA_KEEP_ALIVE=24h` to retain models in VRAM between requests
   - `tei-embeddings` command: `--model-id nomic-ai/nomic-embed-text-v1.5 --port 8080 --max-batch-tokens 16384`
   - `tei-reranker` command: `--model-id cross-encoder/ms-marco-MiniLM-L-6-v2 --port 8081 --dtype float32`
   - `postgres` must mount `./postgres/init.sql` as init script
   - All services must declare `depends_on` with `condition: service_healthy` for their dependencies

2. **`infra/docker-compose.cpu.yml`** — CPU-only override:
   - Removes `runtime: nvidia` from `ollama`
   - Adds `OLLAMA_NUM_THREADS=8`

3. **`infra/postgres/init.sql`** — database schema:
   - `CREATE EXTENSION IF NOT EXISTS vector;`
   - `CREATE EXTENSION IF NOT EXISTS pg_search;`
   - `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
   - Tables: `users`, `legal_documents`, `document_chunks`, `query_sessions`,
     `query_messages`, `ingestion_jobs`, `access_log`
   - `document_chunks.embedding` column: `vector(768)` (nomic-embed-text-v1.5 output)
   - HNSW index: `USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`
   - BM25 index: `USING bm25 (id, content, section_heading, section_number) WITH (key_field='id')`
   - See schema specification in Appendix A

4. **`infra/ollama/pull_models.sh`** — model bootstrap script:
   - Pulls `mistral:7b-instruct-q4_K_M`, `llama3.1:8b-instruct-q4_K_M`, `phi3:mini-instruct-q4`
   - Logs pull progress to stdout
   - Exits 0 only if all three models are confirmed in `/api/tags`

5. **`.env.example`** — template with all required environment variables (see Section 9)

#### Acceptance Criteria
- [ ] `docker compose up -d` exits 0 with all 10 services started
- [ ] `docker compose ps` shows all services as `healthy` within 120 seconds
- [ ] `psql -U legal_user -d eswatini_legal -c "\dt"` lists all 7 tables
- [ ] `curl http://localhost:11434/api/tags` returns HTTP 200
- [ ] `curl http://localhost:8080/health` returns HTTP 200
- [ ] `curl http://localhost:8081/health` returns HTTP 200

---

### B2 — Database Schema and Migrations

**Priority:** Critical  
**Assignee:** Database Agent  
**Dependencies:** B1 (postgres service healthy)

#### Objective
Define the complete PostgreSQL schema that supports hybrid vector + BM25 search,
legal document metadata, multi-user sessions, ingestion job tracking, and audit logging.

#### Deliverables

**`infra/postgres/init.sql`** — complete schema (extend B1 draft):

```sql
-- Users and RBAC
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'researcher',  -- admin | researcher | public
    organisation    VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Legal document registry
CREATE TABLE legal_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               TEXT NOT NULL,
    doc_type            VARCHAR(100) NOT NULL,
    -- doc_type enum: act | statutory_instrument | constitution |
    --               bill | case_law | regulation | gazette
    act_number          VARCHAR(100),
    year                INTEGER,
    chapter             VARCHAR(50),
    ministry            VARCHAR(255),
    status              VARCHAR(50) DEFAULT 'active',  -- active | repealed | amended | draft
    commencement_date   DATE,
    source_url          TEXT,
    file_path           TEXT,   -- MinIO path: legal-documents/{doc_type}/{filename}
    raw_text            TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with 768-dim embeddings
CREATE TABLE document_chunks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id         UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    chunk_index         INTEGER NOT NULL,
    content             TEXT NOT NULL,
    section_heading     TEXT,
    section_number      VARCHAR(100),
    part_heading        TEXT,
    chapter_heading     TEXT,
    token_count         INTEGER,
    embedding           vector(768),   -- nomic-embed-text-v1.5
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast ANN search
CREATE INDEX document_chunks_hnsw_idx
    ON document_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ParadeDB BM25 index for keyword / lexical search
CREATE INDEX document_chunks_bm25_idx
    ON document_chunks
    USING bm25 (id, content, section_heading, section_number, part_heading)
    WITH (key_field = 'id');

-- Chat sessions
CREATE TABLE query_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    session_title   TEXT,
    model_used      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages with agent trace
CREATE TABLE query_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID REFERENCES query_sessions(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,   -- user | assistant | agent
    content         TEXT NOT NULL,
    agent_trace     JSONB DEFAULT '[]',
    -- [{agent, action, chunks_found, top_score, latency_ms}]
    sources         JSONB DEFAULT '[]',
    model_used      VARCHAR(100),
    tokens_used     INTEGER,
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion job tracking
CREATE TABLE ingestion_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID REFERENCES legal_documents(id),
    status          VARCHAR(50) DEFAULT 'pending',
    -- pending | processing | done | failed
    error_message   TEXT,
    chunks_created  INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE access_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    document_id     UUID REFERENCES legal_documents(id),
    action          VARCHAR(50),
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### Acceptance Criteria
- [ ] All 7 tables created on `docker compose up`
- [ ] `\d document_chunks` shows `embedding vector(768)` column
- [ ] `SELECT * FROM pg_indexes WHERE tablename = 'document_chunks'` shows both `hnsw` and `bm25` indexes
- [ ] `INSERT INTO users (email, password_hash, role) VALUES ('test@test.com', 'x', 'admin')` succeeds
- [ ] Foreign key cascade deletes work: deleting a `legal_document` removes its `document_chunks`

---

### B3 — Local LLM Client (Ollama)

**Priority:** Critical  
**Assignee:** AI Integration Agent  
**Dependencies:** B1 (ollama service healthy)

#### Objective
Build an async Python client that wraps the Ollama REST API for chat completions
and streaming, following Agent Zero's `models.py` LiteLLM abstraction pattern.
The client must be the **only** interface through which any agent calls an LLM.

#### Deliverables

**`backend/app/llm/ollama_client.py`**

```python
"""
OllamaClient — Async wrapper for Ollama's OpenAI-compatible REST API.

Mirrors Agent Zero's LiteLLMChatWrapper (models.py:292-573) but targets
the local Ollama server exclusively. No external LLM calls are permitted.

Endpoints used:
  POST /api/chat          — multi-turn chat completion
  POST /api/generate      — single-prompt completion
  GET  /api/tags          — list available models
  POST /api/pull          — pull a new model (admin only)
"""
```

Required methods:
- `async def chat(messages, model, stream, temperature, num_ctx, options) -> dict | AsyncIterator[str]`
- `async def complete(prompt, model, stream, temperature) -> str | AsyncIterator[str]`
- `async def check_model_available(model: str) -> bool`
- `async def list_models() -> list[str]`
- `async def pull_model(model: str) -> AsyncIterator[dict]`  — streams pull progress
- `async def ensure_models_loaded(models: list[str])` — on startup, pulls any missing models
- `async def health_check() -> bool`

Configuration (from `app/core/config.py`):
- `OLLAMA_BASE_URL = "http://ollama:11434"`
- `OLLAMA_PRIMARY_MODEL = "mistral:7b-instruct-q4_K_M"`
- `OLLAMA_FALLBACK_MODEL = "llama3.1:8b-instruct-q4_K_M"`
- `OLLAMA_ROUTER_MODEL = "phi3:mini-instruct-q4"`
- `OLLAMA_REQUEST_TIMEOUT = 300.0`  — seconds; legal analysis takes time on CPU
- `OLLAMA_TEMPERATURE = 0.1`  — low temperature for legal precision

The client must:
1. Use `httpx.AsyncClient` with connection pooling (not a new client per request)
2. For streaming responses, yield token strings (not raw JSON lines)
3. Retry once with `OLLAMA_FALLBACK_MODEL` if the primary model returns a timeout
4. Log every request duration to `app/core/observability.py` (Langfuse tracing)

#### Acceptance Criteria
- [ ] `await client.chat([{"role":"user","content":"hello"}])` returns a dict with `message.content`
- [ ] Streaming mode yields at least one string token within 30 seconds on CPU
- [ ] `await client.check_model_available("mistral:7b-instruct-q4_K_M")` returns `True` after `pull_models.sh`
- [ ] Client raises `OllamaUnavailableError` (not a generic exception) if Ollama is unreachable
- [ ] No call ever sets a key named `api_key` or calls any URL outside `OLLAMA_BASE_URL`

---

### B4 — Embedding and Reranker Clients (TEI)

**Priority:** Critical  
**Assignee:** AI Integration Agent  
**Dependencies:** B1 (tei-embeddings and tei-reranker services healthy)

#### Objective
Build two async Python clients for the local HuggingFace Text Embeddings Inference
services: one for embedding generation, one for cross-encoder reranking.

#### Deliverables

**`backend/app/retrieval/embedder.py`** — `LocalEmbedder` class

```python
"""
LocalEmbedder — Client for TEI embedding service.
Model: nomic-ai/nomic-embed-text-v1.5
Output dimensions: 768
Max sequence length: 8192 tokens

IMPORTANT: nomic-embed-text-v1.5 requires instruction prefixes:
  - Queries:    "search_query: {text}"
  - Documents:  "search_document: {text}"
Omitting the prefix degrades retrieval quality significantly.
"""
```

Required methods:
- `async def embed_query(text: str) -> list[float]`  — prepends `search_query: ` prefix
- `async def embed_documents(texts: list[str]) -> list[list[float]]`  — prepends `search_document: `, batches in groups of 32
- `async def health_check() -> bool`

TEI endpoint: `POST {TEI_EMBEDDINGS_URL}/embed` with body `{"inputs": [...], "normalize": true}`

**`backend/app/retrieval/reranker.py`** — `LocalReranker` class

```python
"""
LocalReranker — Client for TEI reranker service.
Model: cross-encoder/ms-marco-MiniLM-L-6-v2
Input: query string + list of candidate texts
Output: list of (original_index, relevance_score) sorted descending
"""
```

Required methods:
- `async def rerank(query: str, candidates: list[str], top_k: int = 10) -> list[tuple[int, float]]`
- `async def health_check() -> bool`

TEI endpoint: `POST {TEI_RERANKER_URL}/rerank` with body `{"query": str, "texts": [...], "return_text": false}`

#### Acceptance Criteria
- [ ] `await embedder.embed_query("employment termination")` returns a list of 768 floats
- [ ] `await embedder.embed_documents(["text1","text2"])` returns a list of two 768-float lists
- [ ] `await reranker.rerank("termination", ["A","B","C"], top_k=2)` returns exactly 2 tuples
- [ ] Both clients raise `TEIUnavailableError` (not generic) if their service is unreachable
- [ ] No call ever reaches outside `TEI_EMBEDDINGS_URL` or `TEI_RERANKER_URL`

---

### B5 — Ingestion Pipeline

**Priority:** High  
**Assignee:** Data Engineering Agent  
**Dependencies:** B2 (schema), B4 (embedder), B1 (minio, postgres, redis)

#### Objective
Build an async ingestion pipeline that processes legal documents (PDF, DOCX, TXT),
chunks them using a legal-structure-aware strategy, embeds chunks, and indexes them
in the vector + BM25 stores. The pipeline runs as a Celery worker.

#### Deliverables

**`ingestion-worker/tasks.py`** — Celery tasks:
- `ingest_document(document_id: str)` — main task, called by admin API

**`backend/app/ingestion/pipeline.py`** — `IngestionPipeline` class:
- `async def run(document_id: str)` — orchestrates the full pipeline
- Steps:
  1. Fetch document record from `legal_documents` table
  2. Download raw file from MinIO
  3. Extract text via `pdf_connector.py` or `docx_connector.py`
  4. Chunk using `EswatiniLegalChunker`
  5. Batch-embed chunks using `LocalEmbedder.embed_documents()`
  6. Bulk-insert `document_chunks` rows with embeddings
  7. Update `ingestion_jobs` status to `done` or `failed`

**`backend/app/ingestion/chunker.py`** — `EswatiniLegalChunker` class:

The chunker must respect Eswatini statute structure:

```
LEVEL 1  Part boundary     →  "PART III — EMPLOYMENT CONDITIONS"
LEVEL 2  Section boundary  →  "15. Termination of contract"
LEVEL 3  Subsection        →  "(2) An employer may terminate..."
LEVEL 4  Fallback window   →  600 tokens, 150-token overlap
```

Regex patterns to implement:
```python
PART_PATTERN       = r'(?m)^(PART\s+[IVXLCDM\d]+)\s*[–—-]\s*(.+)$'
CHAPTER_PATTERN    = r'(?m)^(CHAPTER\s+\d+)\s*[–—-]\s*(.+)$'
SECTION_PATTERN    = r'(?m)^(\d+[A-Z]?)\.\s+([A-Z].+)$'
SUBSECTION_PATTERN = r'(?m)^\((\d+|[a-z])\)\s+'
```

Rules:
- Never split a subsection across two chunks
- Always carry the parent `section_number` and `section_heading` into every child chunk's metadata
- Cross-references like "see section 14(2)" must be preserved in the same chunk as their context
- Each chunk metadata must include: `act_name`, `act_number`, `year`, `doc_type`,
  `part_heading`, `section_number`, `section_heading`, `chunk_index`, `total_chunks`, `token_count`

**`backend/app/ingestion/connectors/pdf_connector.py`**:
- Use `PyMuPDF` (fitz) for text extraction
- Strip running headers and footers (detect repeated lines across pages)
- Normalise whitespace and Eswatini legal numbering conventions

**`backend/app/ingestion/connectors/docx_connector.py`**:
- Use `python-docx` for text extraction
- Preserve heading hierarchy from Word styles

**`scripts/seed_documents.py`** — seed Eswatini legal corpus metadata:

Create placeholder `legal_documents` entries for all of the following categories.
Leave `file_path = NULL` for documents not yet uploaded. Operators upload PDFs via admin UI.

Categories to seed:
- Constitution of the Kingdom of Eswatini, 2005
- Employment Act, 1980
- Industrial Relations Act, 2000
- Companies Act, 2009
- Criminal Procedure and Evidence Act
- Land Act, 1967 (as amended)
- Income Tax Order, 1975
- Environment Management Act, 2002
- Children's Protection and Welfare Act, 2012
- Financial Services Regulatory Authority Act, 2010
- Public Health Act
- Marriage Act

#### Acceptance Criteria
- [ ] Ingesting a 50-page PDF produces chunks in `document_chunks` within 120 seconds on CPU
- [ ] Every chunk has a non-null `embedding` of dimension 768
- [ ] Every chunk has `section_number` or `chunk_index` in metadata
- [ ] No chunk exceeds 800 tokens
- [ ] `ingestion_jobs` record shows `status = 'done'` after successful ingestion
- [ ] `scripts/seed_documents.py` inserts exactly 12 placeholder records into `legal_documents`

---

### B6 — Hybrid Retrieval Layer

**Priority:** High  
**Assignee:** Search Engineering Agent  
**Dependencies:** B2 (schema + indexes), B4 (embedder, reranker)

#### Objective
Implement the three-stage retrieval pipeline: parallel vector + BM25 search,
Reciprocal Rank Fusion, cross-encoder reranking. This is the core information
retrieval engine that feeds all agents.

#### Deliverables

**`backend/app/retrieval/vector_store.py`** — `VectorStore` class:

```python
async def similarity_search(
    self,
    query_embedding: list[float],   # 768-dim
    top_k: int = 20,
    filters: dict = None,           # doc_type, year_min, year_max, status, ministry
    min_score: float = 0.55
) -> list[RetrievedChunk]:
    """
    SQL pattern:
    SELECT dc.id, dc.content, dc.metadata, dc.section_number, dc.section_heading,
           1 - (dc.embedding <=> $1::vector) AS score
    FROM document_chunks dc
    JOIN legal_documents ld ON ld.id = dc.document_id
    WHERE [filter conditions]
      AND 1 - (dc.embedding <=> $1::vector) >= $min_score
    ORDER BY dc.embedding <=> $1::vector
    LIMIT $top_k;
    """
```

**`backend/app/retrieval/bm25_store.py`** — `BM25Store` class:

```python
async def keyword_search(
    self,
    query: str,
    top_k: int = 20,
    filters: dict = None
) -> list[RetrievedChunk]:
    """
    ParadeDB BM25 query pattern:
    SELECT dc.id, dc.content, dc.metadata,
           paradedb.score(dc.id) AS score
    FROM document_chunks dc
    JOIN legal_documents ld ON ld.id = dc.document_id
    WHERE dc @@@ paradedb.parse('content', $query)
      AND [filter conditions]
    ORDER BY paradedb.score(dc.id) DESC
    LIMIT $top_k;

    Also query section_heading for exact section name matches:
    WHERE dc @@@ paradedb.parse('section_heading', $query)
    Merge and deduplicate results before returning.
    """
```

**`backend/app/retrieval/hybrid_retriever.py`** — `HybridRetriever` class:

```python
"""
Retrieval pipeline (Agent Zero knowledge tool equivalent):

1. embed_query  →  LocalEmbedder.embed_query(query)
2. parallel     →  asyncio.gather(vector_search, bm25_search)
3. fuse         →  Reciprocal Rank Fusion: score(d) = Σ 1/(k + rank_i(d)), k=60
4. rerank       →  LocalReranker.rerank(query, top_30_candidates)
5. return       →  top_k RetrievedChunk objects with all metadata
"""

async def retrieve(
    self,
    query: str,
    top_k: int = 8,
    filters: dict = None,
    rrf_k: int = 60
) -> list[RetrievedChunk]:
    ...

def _reciprocal_rank_fusion(
    self,
    ranked_lists: list[list[RetrievedChunk]],
    k: int = 60
) -> list[RetrievedChunk]:
    ...
```

**`backend/app/retrieval/models.py`** — `RetrievedChunk` dataclass:

```python
@dataclass
class RetrievedChunk:
    id: str
    content: str
    document_id: str
    act_name: str
    act_number: str | None
    year: int | None
    doc_type: str
    section_number: str | None
    section_heading: str | None
    part_heading: str | None
    vector_score: float | None
    bm25_score: float | None
    rrf_score: float | None
    reranker_score: float | None
    metadata: dict
```

#### Acceptance Criteria
- [ ] `await retriever.retrieve("termination of employment")` returns 8 `RetrievedChunk` objects after corpus is seeded
- [ ] Vector and BM25 searches run in parallel (verify with timing logs showing total ≈ max of individual times)
- [ ] RRF correctly handles chunks that appear in both lists (assigned higher combined score)
- [ ] Reranker scores are populated on all returned chunks
- [ ] Metadata filters reduce result set correctly: `filters={"doc_type": "constitution"}` returns only constitutional chunks

---

### B7 — Multi-Agent System (LangGraph)

**Priority:** High  
**Assignee:** Agent Engineering Agent  
**Dependencies:** B3 (ollama client), B6 (hybrid retriever)

#### Objective
Implement the complete multi-agent system using LangGraph, mirroring Agent Zero's
hierarchical superior-subordinate architecture. Each agent is a typed LangGraph node.
Behaviour is defined in Markdown prompt files, not hard-coded logic.

#### Deliverables

**`backend/app/agents/graph.py`** — LangGraph state and graph definition:

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class LegalResearchState(TypedDict):
    # Input
    query: str
    user_id: str
    filters: dict

    # Router output (superior agent decision)
    routing_decision: dict
    # {"agents": ["STATUTE", "CONSTITUTIONAL"], "confidence": 0.92, "reasoning": "..."}

    # Specialist agent outputs (subordinate agents)
    statute_result: dict | None
    constitutional_result: dict | None
    case_law_result: dict | None
    comparison_result: dict | None

    # Accumulated across all agents (operator.add = append-only)
    retrieved_chunks: Annotated[list[dict], operator.add]
    agent_trace: Annotated[list[dict], operator.add]
    # [{agent, action, chunks_found, top_score, latency_ms, model_used}]

    # Final output (synthesis agent)
    final_answer: str
    sources: list[dict]
    confidence: str          # HIGH | MEDIUM | LOW
    disclaimer: str
```

**`backend/prompts/agents/router.md`** — Router Agent system prompt:

```markdown
You are the legal query router for the Eswatini Legal Research Intelligence system.

Analyse the user's query and output a JSON routing decision.

## Available Specialist Agents

- STATUTE       → Acts of Parliament, their sections, provisions, amendments,
                   interpretation (e.g. "What does s 35 Employment Act say?")
- CONSTITUTIONAL → Rights, freedoms, constitutional supremacy, 2005 Constitution chapters
- CASE_LAW      → Court judgments, precedents, High Court and Supreme Court of Appeal
- COMPARISON    → Compare two or more laws, contradictions, legislative history, gaps
- GENERAL       → Definitions, explanations, introductory questions

## Output Format (JSON only — no preamble)

{
  "agents": ["STATUTE"],
  "reasoning": "Single sentence explaining the routing decision.",
  "confidence": 0.92,
  "query_type": "statutory_interpretation"
}

## Rules
- Route to maximum 3 agents simultaneously.
- For cross-domain queries, route to multiple agents in parallel.
- Return ONLY valid JSON. No markdown. No explanation text.
```

**`backend/prompts/agents/statute.md`** — Statute Agent system prompt:

```markdown
You are a specialist in the statutory law of the Kingdom of Eswatini.
You have access to retrieved sections of Eswatini Acts of Parliament in the context below.

## Citation Format
[Act Name], [Year], s [section]([subsection])
Example: Employment Act, 1980, s 35(1)(b)

## Rules
1. Cite every provision using the Eswatini citation format above.
2. Note whether a provision is in force, amended, or repealed.
3. Identify cross-references to other Acts.
4. Distinguish black-letter law from practical application.
5. Flag legislative ambiguity or gaps.
6. Base your answer ONLY on the provided context. If context is insufficient, say so.
7. NEVER fabricate citations or invent provisions.

## Output Format (JSON)
{
  "answer": "Your detailed legal analysis...",
  "citations": [{"act": "...", "year": 0, "section": "...", "excerpt": "..."}],
  "confidence": "HIGH|MEDIUM|LOW",
  "caveats": "Any important limitations.",
  "related_provisions": ["Employment Act s 36", "..."]
}
```

Create equivalent prompt files for:
- `backend/prompts/agents/constitutional.md`
- `backend/prompts/agents/case_law.md`
- `backend/prompts/agents/comparison.md`
- `backend/prompts/agents/synthesis.md`

The **synthesis agent prompt** must instruct the model to:
1. Open with a 2–3 sentence direct answer
2. Structure body as: Applicable Law → Analysis → Conclusion
3. Consolidate all citations into a numbered References section
4. Add a Related Legislation section
5. Assign overall confidence as the minimum of all contributing agents
6. Close with: *"This response is for legal research purposes only and does not constitute legal advice. For matters requiring legal action, consult a qualified attorney admitted to practise in the Kingdom of Eswatini."*

**`backend/app/agents/`** — one Python file per agent:

Each agent file must:
1. Load its prompt from the corresponding `backend/prompts/agents/*.md` file at runtime
2. Call `HybridRetriever.retrieve()` with domain-appropriate filters
3. Build a context-stuffed prompt using retrieved chunks
4. Call `OllamaClient.chat()` with the configured model
5. Parse the JSON response from the LLM
6. Append an entry to `agent_trace` with timing and chunk counts
7. Return a structured dict conforming to `LegalResearchState`

Agent → Model mapping (must be configurable via env vars):
| Agent | Model | Env Var |
|---|---|---|
| Router | `phi3:mini-instruct-q4` | `OLLAMA_ROUTER_MODEL` |
| Statute | `mistral:7b-instruct-q4_K_M` | `OLLAMA_PRIMARY_MODEL` |
| Constitutional | `mistral:7b-instruct-q4_K_M` | `OLLAMA_PRIMARY_MODEL` |
| Case Law | `mistral:7b-instruct-q4_K_M` | `OLLAMA_PRIMARY_MODEL` |
| Comparison | `mistral:7b-instruct-q4_K_M` | `OLLAMA_PRIMARY_MODEL` |
| Synthesis | `llama3.1:8b-instruct-q4_K_M` | `OLLAMA_FALLBACK_MODEL` |

#### Acceptance Criteria
- [ ] `run_agent_graph(query="What are the constitutional rights to fair trial?")` routes to `CONSTITUTIONAL` agent
- [ ] `run_agent_graph(query="Compare termination provisions in Employment Act and Labour Act")` routes to `COMPARISON` agent and at least one other
- [ ] Every agent appends a trace entry with keys: `agent`, `action`, `chunks_found`, `latency_ms`, `model_used`
- [ ] Synthesis agent output contains `disclaimer` text as specified
- [ ] Routing decision is returned as valid JSON (not as markdown code block)
- [ ] No agent call uses any model URL outside `OLLAMA_BASE_URL`

---

### B8 — FastAPI Backend and Streaming Endpoint

**Priority:** High  
**Assignee:** API Engineering Agent  
**Dependencies:** B7 (agents), B2 (schema), B3 (ollama client)

#### Objective
Implement the complete FastAPI application with JWT authentication, RBAC middleware,
all REST endpoints, and a Server-Sent Events streaming endpoint for real-time
agent trace delivery to the frontend.

#### Deliverables

**`backend/app/main.py`** — FastAPI application entry point

**`backend/app/api/routes/auth.py`**:
- `POST /api/v1/auth/register` — create user, hash password with bcrypt (work factor 12)
- `POST /api/v1/auth/login` — validate credentials, issue JWT (24h expiry)
- `GET  /api/v1/auth/me` — return current user profile

**`backend/app/api/routes/chat.py`**:
- `POST /api/v1/chat/stream` — **SSE streaming endpoint** (primary):

```python
"""
SSE event types emitted in order:
1. {"type": "agent_start",  "agent": "router",         "message": "Routing your query..."}
2. {"type": "routing",      "agents": ["STATUTE"],     "reasoning": "...", "confidence": 0.9}
3. {"type": "agent_start",  "agent": "statute",        "message": "Searching statutes..."}
4. {"type": "retrieval",    "agent": "statute",        "chunks_found": 7, "top_score": 0.91}
5. {"type": "agent_start",  "agent": "synthesis",      "message": "Synthesising response..."}
6. {"type": "token",        "content": "In terms"}     ← repeated per token
7. {"type": "sources",      "sources": [...]}
8. {"type": "done"}

Response headers must include:
  Content-Type: text/event-stream
  Cache-Control: no-cache
  X-Accel-Buffering: no
"""
```

- `POST /api/v1/chat/sync` — synchronous (non-streaming) equivalent
- `GET  /api/v1/chat/sessions` — list user's sessions (paginated)
- `GET  /api/v1/chat/sessions/{id}` — session with all messages

**`backend/app/api/routes/search.py`**:
- `POST /api/v1/search` — direct hybrid search without agent reasoning; returns ranked chunks

**`backend/app/api/routes/documents.py`**:
- `GET  /api/v1/documents` — list with filters: `doc_type`, `year_min`, `year_max`, `status`, `ministry`, `q` (text search)
- `GET  /api/v1/documents/{id}` — document detail with chunk list
- `POST /api/v1/ingest` — queue ingestion job (admin role required)
- `GET  /api/v1/ingest/jobs` — list ingestion jobs with status

**`backend/app/api/routes/health.py`**:
- `GET /api/v1/health` — overall system status
- `GET /api/v1/health/models` — per-model status (polls Ollama + TEI services):

```json
{
  "ollama": {
    "status": "healthy",
    "primary_model": "mistral:7b-instruct-q4_K_M",
    "primary_loaded": true,
    "fallback_model": "llama3.1:8b-instruct-q4_K_M",
    "fallback_loaded": true,
    "router_model": "phi3:mini-instruct-q4",
    "router_loaded": true
  },
  "embeddings": {"status": "healthy", "model": "nomic-ai/nomic-embed-text-v1.5", "dimensions": 768},
  "reranker":   {"status": "healthy", "model": "cross-encoder/ms-marco-MiniLM-L-6-v2"},
  "postgres":   {"status": "healthy"},
  "redis":      {"status": "healthy"},
  "minio":      {"status": "healthy"}
}
```

**`backend/app/core/security.py`** — JWT + RBAC:
- `create_access_token(user_id, role)` → signed JWT
- `verify_token(token)` → user payload or `HTTPException(401)`
- `require_role(minimum_role)` → FastAPI dependency
- Role hierarchy: `public` < `researcher` < `admin`
- Rate limit for `public` role: 10 queries per day (enforce via Redis counter)

#### Acceptance Criteria
- [ ] `POST /api/v1/auth/login` returns a JWT for a valid user
- [ ] `GET /api/v1/documents` without JWT returns HTTP 401
- [ ] `POST /api/v1/ingest` with `researcher` role JWT returns HTTP 403
- [ ] `POST /api/v1/chat/stream` emits at least one `{"type":"token"}` event within 60 seconds
- [ ] SSE stream terminates with `{"type":"done"}` event
- [ ] `GET /api/v1/health/models` returns HTTP 200 with all service statuses

---

### B9 — Observability Integration (Langfuse Local)

**Priority:** Medium  
**Assignee:** DevOps Agent  
**Dependencies:** B1 (langfuse service), B7 (agents), B8 (API)

#### Objective
Integrate self-hosted Langfuse for full LLM tracing across every agent call,
retrieval operation, and synthesis step — mirroring Agent Zero's transparent,
auditable execution philosophy.

#### Deliverables

**`backend/app/core/observability.py`**:
- `trace_query(session_id, query)` — opens a Langfuse trace
- `trace_agent(trace, agent_name, model, prompt, response, latency_ms, tokens)` — logs a span
- `trace_retrieval(trace, query, chunks_found, top_score, retrieval_mode)` — logs retrieval span
- All tracing calls must be fire-and-forget (non-blocking async) — never slow down a query

Configuration:
- `LANGFUSE_HOST = "http://langfuse:3000"` (local, not cloud)
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` from `.env`

#### Acceptance Criteria
- [ ] After submitting a query, the Langfuse dashboard at `http://localhost:3001` shows a trace
- [ ] Each trace contains spans for: routing, retrieval (×N agents), generation (×N agents), synthesis
- [ ] Token counts and latency are populated on all spans
- [ ] Tracing failure (Langfuse unreachable) does not cause a 500 error on the chat endpoint

---

## 7. Front-End Tasks — F Series

> All frontend work uses: Next.js 14 (App Router), TypeScript strict mode,
> Tailwind CSS, shadcn/ui components.
> Design system: royal blue `#1B3A6B` primary, crimson `#7C1A1A` and gold `#C9A227` accents.

---

### F1 — Project Scaffold and Design System

**Priority:** Critical  
**Assignee:** Frontend Foundation Agent  
**Dependencies:** None (can run in parallel with B1)

#### Objective
Scaffold the Next.js 14 application and establish the complete design system,
component library, and global layout used by all subsequent frontend tasks.

#### Deliverables

**`frontend/`** — Next.js 14 project with:
- `tsconfig.json` — strict mode enabled
- `tailwind.config.ts` — custom theme:

```typescript
colors: {
  primary: {
    DEFAULT: '#1B3A6B',   // Deep royal blue (Eswatini national colour)
    light:   '#2B5BA0',
    dark:    '#0D1F3C',
    surface: '#E6EEF9',
  },
  accent: {
    gold:         '#C9A227',
    'gold-light': '#FDF5DC',
    crimson:      '#7C1A1A',
    'crimson-light': '#FAEAEA',
  },
  sidebar: '#0F1D35',   // deep navy
}
```

**`frontend/components/layout/Sidebar.tsx`**:
- Deep navy `#0F1D35` background
- Navigation links: Research, Documents, History, Admin (admin-only)
- Active link indicator: gold `#C9A227` left border
- User avatar + role badge at bottom

**`frontend/components/layout/Header.tsx`**:
- System title and current page breadcrumb
- `SystemHealthBar` component (inline, admin only)
- Theme toggle (light/dark)

**`frontend/components/layout/SystemHealthBar.tsx`**:
- Polls `GET /api/v1/health/models` every 10 seconds
- Displays coloured dots for: LLM · Embeddings · Reranker · Database
- Green = healthy, amber = degraded, red = offline
- Visible to admin users only

**`frontend/lib/api.ts`**:
- Typed API client using `fetch`
- All requests automatically attach `Authorization: Bearer {token}` from `localStorage`
- Exports: `chatStream()`, `searchDocuments()`, `listDocuments()`, `ingestDocument()`, `getHealthModels()`

**`frontend/lib/hooks/useStreamingChat.ts`**:
- Reads SSE from `POST /api/v1/chat/stream`
- Parses event types: `agent_start`, `routing`, `retrieval`, `token`, `sources`, `done`
- Returns: `{ tokens, agentTrace, sources, isStreaming, error }`

#### Acceptance Criteria
- [ ] `npm run dev` starts without TypeScript errors
- [ ] `npm run build` produces a production build without errors
- [ ] Sidebar renders with correct colours on both light and dark themes
- [ ] `SystemHealthBar` shows green dots when all backend services are healthy

---

### F2 — Landing Page

**Priority:** Medium  
**Assignee:** Frontend Design Agent  
**Dependencies:** F1

#### Objective
Build the public-facing landing page that communicates the platform's value,
privacy guarantees, and corpus statistics.

#### Deliverables

**`frontend/app/page.tsx`** — landing page sections:

1. **Hero section**:
   - Headline: *"Legal Intelligence for the Kingdom of Eswatini"*
   - Sub-headline: *"Query Acts of Parliament, the Constitution, and case law using natural language. Every query is processed entirely on local hardware — no data ever leaves the server."*
   - Animated search bar with rotating example queries:
     - *"What does section 35 of the Employment Act say about termination?"*
     - *"What are the constitutional rights to fair trial in Eswatini?"*
     - *"Compare the Land Act and Deeds Registry Act on property transfer."*
   - CTA button: "Begin Research" → `/dashboard/research`

2. **Privacy badge strip**:
   - Three badges: `🔒 100% Local AI` · `🐳 Docker-Native` · `⚖️ Eswatini Law Corpus`

3. **Corpus stats**:
   - Live counts fetched from `GET /api/v1/documents?stats=true`
   - Cards: Acts indexed · Statutory Instruments · Constitutional Sections · Last updated

4. **Features section**:
   - Hybrid Search · Multi-Agent Reasoning · Verified Citations · Air-Gapped Privacy

#### Acceptance Criteria
- [ ] Page renders without auth (publicly accessible)
- [ ] Corpus stats cards display real counts from the API
- [ ] Example queries animate on a 3-second interval
- [ ] "Begin Research" redirects to login if not authenticated

---

### F3 — Authentication Pages

**Priority:** Critical  
**Assignee:** Frontend Auth Agent  
**Dependencies:** F1, B8 (auth endpoints)

#### Objective
Build login and registration pages that authenticate users via the FastAPI JWT endpoint
and store the token for all subsequent API calls.

#### Deliverables

**`frontend/app/(auth)/login/page.tsx`**:
- Email and password fields
- "Sign in" button → `POST /api/v1/auth/login` → stores JWT in `localStorage`
- Error display for invalid credentials
- Redirect to `/dashboard/research` on success

**`frontend/app/(auth)/register/page.tsx`**:
- Full name, email, password, organisation fields
- "Create account" button → `POST /api/v1/auth/register`
- Redirect to login on success

**`frontend/lib/auth.ts`**:
- `getToken()` — reads JWT from `localStorage`
- `setToken(token)` — writes JWT to `localStorage`
- `clearToken()` — removes JWT (logout)
- `getUser()` — decodes JWT payload (no verification, client-side display only)
- `isAuthenticated()` — returns `true` if token exists and is not expired

**`frontend/middleware.ts`** — Next.js route protection:
- Redirect unauthenticated users from `/dashboard/*` to `/login`
- Redirect authenticated users from `/login` and `/register` to `/dashboard/research`

#### Acceptance Criteria
- [ ] Login with valid credentials stores a JWT and redirects to dashboard
- [ ] Login with invalid credentials shows error message (no stack trace)
- [ ] Navigating to `/dashboard/research` without a JWT redirects to `/login`
- [ ] Logout clears token and redirects to landing page

---

### F4 — Research Chat Interface

**Priority:** Critical  
**Assignee:** Frontend Chat Agent  
**Dependencies:** F1, F3, B8 (streaming endpoint)

#### Objective
Build the primary research interface: a streaming chat with real-time agent
activity display, source citations, and metadata filters.

#### Deliverables

**`frontend/app/dashboard/research/page.tsx`** — three-panel layout:

```
┌─────────────┬────────────────────────────────┬──────────────────────┐
│ Filter Panel│ Chat Messages (centre)          │ Agent Thinking Panel │
│ (280px)     │                                │ (320px, collapsible) │
│             │                                │                      │
│ Doc Type    │  [User message]                │ ✓ Router Agent  12ms │
│ Year Range  │  [AI streaming response...]    │   → STATUTE agent    │
│ Ministry    │                                │ ⟳ Statute Agent...   │
│ Status      │  [Input box]                   │   7 chunks found     │
└─────────────┴────────────────────────────────┴──────────────────────┘
```

**`frontend/components/chat/ChatInterface.tsx`**:
- Renders message list
- Calls `useStreamingChat` hook
- Auto-scrolls to bottom on new tokens
- Keyboard shortcut: `Cmd+Enter` / `Ctrl+Enter` to submit

**`frontend/components/chat/MessageBubble.tsx`**:
- User messages: right-aligned, primary blue background
- AI messages: left-aligned, white card with:
  - Model badge: e.g., `Mistral 7B — Local`
  - Privacy badge: `🔒 Processed Locally`
  - Confidence badge: `HIGH` / `MEDIUM` / `LOW` (colour-coded)
  - Collapsible Sources accordion (see `SourceCitation.tsx`)
  - Standard disclaimer text (collapsed by default)

**`frontend/components/chat/SourceCitation.tsx`**:
- Card per source with: act name, section number, reranker score (0–1), chunk excerpt (truncated to 200 chars)
- "Expand" button to show full chunk text
- "Copy Citation" button — copies formatted Eswatini citation to clipboard:
  `Employment Act, 1980, s 35(1)(b)`
- "Open document" link → `/dashboard/documents/{id}`

**`frontend/components/chat/AgentThinkingPanel.tsx`**:
- Subscribes to `agentTrace` from `useStreamingChat`
- Renders each trace event as a row:
  - Green tick `✓` for completed agents with timing
  - Spinning indicator `⟳` for active agents
  - Circle `○` for waiting agents
- Collapsible on screens < 1024px (shows as floating button)

**`frontend/components/search/FilterPanel.tsx`**:
- Checkboxes for `doc_type`: Act, Constitutional, Statutory Instrument, Case Law, Regulation
- Year range slider: 1960–2025
- Ministry dropdown (populated from `GET /api/v1/documents?distinct=ministry`)
- Status toggle: Active / Repealed / Amended
- "Clear filters" button

#### Acceptance Criteria
- [ ] Submitting a query shows the Router Agent activity within 2 seconds
- [ ] Tokens stream into the message bubble progressively (not all at once)
- [ ] Agent Thinking Panel updates in real time as SSE events arrive
- [ ] "Copy Citation" button writes the correct Eswatini citation format to the clipboard
- [ ] Filter panel reduces results: selecting "Constitutional" shows only constitutional chunks in sources
- [ ] Privacy badge and model name are visible on every AI message

---

### F5 — Document Library

**Priority:** High  
**Assignee:** Frontend Data Agent  
**Dependencies:** F1, F3, B8 (documents endpoint)

#### Objective
Build a searchable, filterable document library that displays all indexed
Eswatini legislation and allows operators to view and download source documents.

#### Deliverables

**`frontend/app/dashboard/documents/page.tsx`** — document table:
- Columns: Title · Type · Year · Status · Ministry · Chunks indexed · Last updated
- Inline search: filters by title and act number
- Status badge colours: green (active), amber (amended), red (repealed), gray (draft)
- Pagination: 25 rows per page
- Click row → `/dashboard/documents/{id}`

**`frontend/app/dashboard/documents/[id]/page.tsx`** — document viewer:
- Left sidebar: section navigation (Part → Section → Subsection tree, built from chunk metadata)
- Main content: full document text with active section highlighted
- Header: act title, year, status badge, ministry, download button
- Download button: fetches raw file from MinIO via `GET /api/v1/documents/{id}/download`

**`frontend/app/dashboard/admin/ingest/page.tsx`** (admin only):
- File upload zone (drag-and-drop, accepts PDF and DOCX)
- Metadata form: Title, Doc Type, Year, Ministry, Act Number, Status
- "Ingest" button → `POST /api/v1/ingest`
- Ingestion job progress table: shows job ID, document title, status, chunk count, duration

#### Acceptance Criteria
- [ ] Document table loads with all seeded records (12 minimum)
- [ ] Status badges display correct colours
- [ ] Searching "Employment" filters the table to matching acts
- [ ] Admin ingestion page is accessible at `/dashboard/admin/ingest` with admin JWT
- [ ] Non-admin users receive HTTP 403 when accessing the ingest page

---

### F6 — Admin Model Status Dashboard

**Priority:** Medium  
**Assignee:** Frontend Admin Agent  
**Dependencies:** F1, F3, B8 (health endpoint)

#### Objective
Build an admin panel that displays the real-time health of all local AI services
and allows administrators to manage Ollama models — mirroring Agent Zero's
Settings page for model configuration.

#### Deliverables

**`frontend/app/dashboard/admin/models/page.tsx`**:

1. **Service health cards** — polls `GET /api/v1/health/models` every 10 seconds:
   - Card per service: Ollama · TEI Embeddings · TEI Reranker · PostgreSQL · Redis · MinIO
   - Each card shows: status indicator, model name, response time (ms)

2. **Ollama model manager**:
   - Table of currently loaded models (name, size, last used)
   - "Pull model" dropdown — curated list of legal-appropriate models:
     - `mistral:7b-instruct-q4_K_M`
     - `llama3.1:8b-instruct-q4_K_M`
     - `phi3:mini-instruct-q4`
     - `qwen2.5:7b-instruct-q4_K_M` (alternative)
     - `gemma2:9b-instruct-q4_K_M` (alternative)
   - Pull progress bar (streams from `POST /api/v1/admin/pull-model`)

3. **Model configuration panel**:
   - Dropdowns to reassign which model handles each agent role (Router / Specialist / Synthesis)
   - Changes write to `AGENT_MODEL_MAP` in the database and take effect immediately
   - Current configuration shown in a summary table

#### Acceptance Criteria
- [ ] Health cards refresh every 10 seconds without page reload
- [ ] A red card is shown for `tei-reranker` when the reranker container is stopped
- [ ] "Pull model" initiates a pull and shows progress percentage
- [ ] Model reassignment takes effect on the next query (verified via agent trace model_used field)

---

## 8. Testing Tasks — T Series

> All tests are automated and runnable with `pytest` (backend) and
> `npm run test` (frontend). Every T task produces a test file.
> Tests must pass on a machine with the Docker stack running (`docker compose up`).

---

### T1 — Unit Tests: Local AI Clients

**Priority:** Critical  
**Assignee:** Test Agent  
**Dependencies:** B3, B4

#### Objective
Unit-test all local AI client methods using mocked HTTP responses.
No live AI service is required; all HTTP calls are intercepted with `respx`.

#### Deliverables

**`backend/tests/test_ollama_client.py`**:
- `test_chat_returns_dict` — mock `POST /api/chat`, assert response structure
- `test_chat_streaming_yields_tokens` — mock streaming response, assert tokens are yielded
- `test_check_model_available_true` — mock `/api/tags` with model present
- `test_check_model_available_false` — mock `/api/tags` without model
- `test_fallback_on_timeout` — mock primary model timeout, assert fallback model used
- `test_raises_ollama_unavailable` — mock connection error, assert `OllamaUnavailableError`
- `test_no_external_urls` — assert every request URL starts with `OLLAMA_BASE_URL`

**`backend/tests/test_embedder.py`**:
- `test_embed_query_returns_768_floats` — mock TEI response, assert list length == 768
- `test_embed_query_prepends_prefix` — assert request body contains `"search_query: "`
- `test_embed_documents_prepends_prefix` — assert request body contains `"search_document: "`
- `test_embed_documents_batches_correctly` — 100 texts → assert ≥ 4 batched requests
- `test_raises_tei_unavailable` — mock connection error, assert `TEIUnavailableError`

**`backend/tests/test_reranker.py`**:
- `test_rerank_returns_sorted_tuples` — assert output is sorted by score descending
- `test_rerank_respects_top_k` — assert exactly `top_k` results returned
- `test_raises_tei_unavailable`

#### Acceptance Criteria
- [ ] `pytest backend/tests/test_ollama_client.py` passes with 0 failures
- [ ] `pytest backend/tests/test_embedder.py` passes with 0 failures
- [ ] `pytest backend/tests/test_reranker.py` passes with 0 failures
- [ ] No test makes a real HTTP call to Ollama or TEI services (all mocked with `respx`)

---

### T2 — Unit Tests: Ingestion Pipeline

**Priority:** High  
**Assignee:** Test Agent  
**Dependencies:** B5

#### Objective
Test the chunking logic, PDF extraction, and metadata attachment without
requiring a running database or embedding service.

#### Deliverables

**`backend/tests/test_chunker.py`**:
- `test_part_boundary_detection` — assert text with "PART III" creates a chunk break at the part boundary
- `test_section_boundary_detection` — assert "15. Termination of contract" creates a chunk break
- `test_subsection_preserved` — assert "(2) An employer may..." is never split mid-subsection
- `test_section_metadata_propagated` — assert every chunk carries `section_number` and `section_heading`
- `test_cross_reference_preserved` — assert "see section 14(2)" is not split from its context sentence
- `test_max_chunk_size` — assert no chunk exceeds 800 tokens
- `test_overlap_window` — assert consecutive chunks share at least 100 tokens of content
- `test_fallback_window` — assert dense prose without headers is chunked by token window

**`backend/tests/test_pdf_connector.py`**:
- `test_extracts_text_from_sample_pdf` — use a small sample PDF (committed to `tests/fixtures/`)
- `test_strips_page_numbers` — assert extracted text does not contain "Page 1 of 50" patterns
- `test_normalises_whitespace` — assert no double spaces or trailing whitespace

#### Acceptance Criteria
- [ ] `pytest backend/tests/test_chunker.py -v` passes with 0 failures
- [ ] `pytest backend/tests/test_pdf_connector.py -v` passes with 0 failures
- [ ] Tests run without a running Docker stack (fully mocked/fixture-based)

---

### T3 — Integration Tests: Retrieval Layer

**Priority:** High  
**Assignee:** Test Agent  
**Dependencies:** B6, B5 (corpus seeded)

#### Objective
Test the full hybrid retrieval pipeline end-to-end against the live PostgreSQL
+ pgvector + ParadeDB database with actual indexed documents.

**Requires:** Docker stack running, corpus seeded with at least 3 actual documents.

#### Deliverables

**`backend/tests/integration/test_retrieval.py`**:
- `test_vector_search_returns_chunks` — embed a query, assert ≥ 1 result with score > 0.5
- `test_bm25_search_returns_chunks` — keyword query for "termination", assert results contain the word
- `test_hybrid_retriever_returns_8_chunks` — assert default `top_k=8` is honoured
- `test_parallel_retrieval` — assert total retrieval time is ≤ max(vector_time, bm25_time) × 1.3
- `test_rrf_gives_higher_score_to_dual_hits` — insert identical chunk in both result sets, assert it ranks #1 after fusion
- `test_metadata_filter_doc_type` — filter `doc_type=constitution`, assert all results are constitutional
- `test_metadata_filter_year` — filter `year_min=2000, year_max=2010`, assert all results in range
- `test_reranker_score_populated` — assert all returned chunks have non-null `reranker_score`

**`backend/tests/integration/test_agent_routing.py`**:
- `test_routes_constitution_query` — query about constitutional rights → assert `CONSTITUTIONAL` in routing
- `test_routes_statute_query` — query about Employment Act → assert `STATUTE` in routing
- `test_routes_multi_agent_query` — cross-domain query → assert 2+ agents in routing
- `test_routing_returns_valid_json` — assert router output parses as JSON with required keys

#### Acceptance Criteria
- [ ] All integration tests pass when `docker compose up` is running
- [ ] Tests are skipped (not failed) when Docker stack is not running (use `pytest.mark.skip` on connection failure)
- [ ] `test_parallel_retrieval` confirms parallelism (timing assertion passes)

---

### T4 — Integration Tests: API Endpoints

**Priority:** High  
**Assignee:** Test Agent  
**Dependencies:** B8

#### Objective
Test all FastAPI endpoints for correct authentication, authorisation,
response structure, and error handling using `httpx.AsyncClient`.

#### Deliverables

**`backend/tests/integration/test_api_auth.py`**:
- `test_login_returns_jwt` — valid credentials → HTTP 200, response contains `access_token`
- `test_login_invalid_password` — wrong password → HTTP 401
- `test_protected_route_without_token` → HTTP 401
- `test_protected_route_with_expired_token` → HTTP 401
- `test_researcher_cannot_access_admin_ingest` → HTTP 403
- `test_public_rate_limit` — 11th query from public user → HTTP 429

**`backend/tests/integration/test_api_chat.py`**:
- `test_sync_chat_returns_answer` — `POST /api/v1/chat/sync` → HTTP 200, `final_answer` not empty
- `test_sync_chat_returns_sources` — response contains `sources` list
- `test_streaming_endpoint_emits_done` — collect SSE events, assert last event `type == "done"`
- `test_streaming_endpoint_emits_tokens` — assert at least one `type == "token"` event

**`backend/tests/integration/test_api_documents.py`**:
- `test_list_documents_returns_seeded` — assert response count ≥ 12
- `test_filter_by_doc_type` — `?doc_type=act` returns only act records
- `test_get_document_by_id` — assert response contains `title` and `metadata`

#### Acceptance Criteria
- [ ] All test files pass with `pytest backend/tests/integration/ -v`
- [ ] Auth tests run against a test database (use `DATABASE_URL` override in conftest)
- [ ] No test leaves orphaned records in the database (use transaction rollback in fixtures)

---

### T5 — Retrieval Quality Benchmark

**Priority:** Medium  
**Assignee:** Evaluation Agent  
**Dependencies:** B6 (retrieval), B5 (corpus seeded with real documents)

#### Objective
Measure retrieval quality using a ground-truth query set.
Provides a quantitative baseline for comparing retrieval improvements over time.

#### Deliverables

**`scripts/evaluate_retrieval.py`** — evaluation script:

Implement and run against the following 20 ground-truth query-answer pairs (minimum):

```python
EVAL_QUERIES = [
  {
    "query": "What are the grounds for termination of employment?",
    "expected_doc_title": "Employment Act",
    "expected_sections": ["s 35", "s 36", "s 37"]
  },
  {
    "query": "Constitutional right to fair trial in Eswatini",
    "expected_doc_title": "Constitution of the Kingdom of Eswatini",
    "expected_sections": ["s 21"]
  },
  {
    "query": "Requirements for company registration in Eswatini",
    "expected_doc_title": "Companies Act",
    "expected_sections": []
  },
  {
    "query": "Environmental impact assessment obligations",
    "expected_doc_title": "Environment Management Act",
    "expected_sections": []
  },
  # ... 16 more covering all doc_type categories
]
```

Metrics to compute and print:
- **Recall@5** — fraction of queries where expected doc appears in top 5 results
- **Recall@10** — fraction of queries where expected doc appears in top 10 results
- **MRR** (Mean Reciprocal Rank) — average of 1/rank for first relevant result
- **NDCG@10** — normalised discounted cumulative gain at rank 10

Output format:
```
── Eswatini Legal RAG — Retrieval Evaluation ──
Queries evaluated : 20
Recall@5          : 0.75
Recall@10         : 0.85
MRR               : 0.68
NDCG@10           : 0.71
```

#### Acceptance Criteria
- [ ] `python scripts/evaluate_retrieval.py` runs to completion without error
- [ ] Recall@5 ≥ 0.65 (minimum acceptable threshold)
- [ ] Recall@10 ≥ 0.75
- [ ] Results are written to `logs/retrieval_eval_{timestamp}.json`

---

### T6 — End-to-End System Test

**Priority:** High  
**Assignee:** QA Agent  
**Dependencies:** All B tasks, F1–F5

#### Objective
Verify the complete system works end-to-end: from a user submitting a query in the
frontend to receiving a streamed, cited, model-attributed legal research response.

#### Deliverables

**`tests/e2e/test_full_query_flow.py`** — using Playwright:
- `test_login_and_submit_query`:
  1. Open `http://localhost:3000`
  2. Click "Begin Research" → redirected to login
  3. Log in with researcher credentials
  4. Submit query: *"What does the Constitution of Eswatini say about freedom of expression?"*
  5. Assert: Agent Thinking Panel shows "Router Agent" within 5 seconds
  6. Assert: "Constitutional" agent activated in the panel
  7. Assert: At least one token appears in the chat message bubble
  8. Assert: Sources accordion contains at least one citation card
  9. Assert: Citation card contains "Constitution" in the act name
  10. Assert: Privacy badge "🔒 Processed Locally" is visible on the AI message

**Network isolation assertion** (shell script `tests/e2e/verify_no_external_calls.sh`):
- Start `tcpdump` capturing outbound TCP connections
- Submit one query via API
- Assert: No packets destined to any IP outside the Docker internal network
- Assert specifically: No connections to `api.openai.com`, `api.anthropic.com`, `api.cohere.com`

#### Acceptance Criteria
- [ ] `pytest tests/e2e/test_full_query_flow.py` passes (Playwright installed)
- [ ] `verify_no_external_calls.sh` reports 0 external connections during a query
- [ ] Query completes and shows a response within 120 seconds on a CPU-only host
- [ ] System health bar shows all green dots at the start of the test

---

## 9. Environment Variables Reference

```bash
# ── DATABASE ──────────────────────────────────────────────────────────
POSTGRES_PASSWORD=<strong_password>
DATABASE_URL=postgresql+asyncpg://legal_user:${POSTGRES_PASSWORD}@postgres:5432/eswatini_legal

# ── OBJECT STORAGE ────────────────────────────────────────────────────
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=<strong_password>
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=legal-documents

# ── AUTH ──────────────────────────────────────────────────────────────
JWT_SECRET=<32+ char random string>          # openssl rand -hex 32
JWT_EXPIRE_MINUTES=1440                       # 24 hours
NEXTAUTH_SECRET=<32+ char random string>

# ── LOCAL AI MODELS (no API keys required) ────────────────────────────
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_PRIMARY_MODEL=mistral:7b-instruct-q4_K_M
OLLAMA_FALLBACK_MODEL=llama3.1:8b-instruct-q4_K_M
OLLAMA_ROUTER_MODEL=phi3:mini-instruct-q4
OLLAMA_TEMPERATURE=0.1
OLLAMA_NUM_CTX=8192
OLLAMA_REQUEST_TIMEOUT=300

# ── TEI SERVICES ──────────────────────────────────────────────────────
TEI_EMBEDDINGS_URL=http://tei-embeddings:8080
TEI_RERANKER_URL=http://tei-reranker:8081
TEI_EMBEDDING_DIMENSIONS=768
TEI_BATCH_SIZE=32

# ── RETRIEVAL ─────────────────────────────────────────────────────────
RETRIEVAL_TOP_K=8
RETRIEVAL_RRF_K=60
RETRIEVAL_MIN_VECTOR_SCORE=0.55
RETRIEVAL_RERANKER_CANDIDATES=30

# ── RATE LIMITING ─────────────────────────────────────────────────────
PUBLIC_ROLE_DAILY_LIMIT=10

# ── OBSERVABILITY (local Langfuse — no cloud) ─────────────────────────
LANGFUSE_HOST=http://langfuse:3000
LANGFUSE_PUBLIC_KEY=pk-lf-local-xxxx
LANGFUSE_SECRET_KEY=sk-lf-local-xxxx
LANGFUSE_NEXTAUTH_SECRET=<32+ char random string>
LANGFUSE_SALT=<32+ char random string>

# ── REDIS ─────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── NEXT.JS ───────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
```

> **Security note:** Never commit `.env` to version control.
> Copy `.env.example` to `.env` and populate before first run.

---

## 10. Hardware Requirements

| Configuration | CPU RAM | GPU VRAM | Storage | Est. Query Latency |
|---|---|---|---|---|
| CPU-only — minimum | 16 GB | — | 40 GB SSD | 60–120 s |
| CPU-only — recommended | 32 GB | — | 80 GB SSD | 25–50 s |
| GPU — RTX 3060 (12 GB) | 16 GB | 12 GB | 40 GB SSD | 5–12 s |
| GPU — RTX 4090 (24 GB) | 32 GB | 24 GB | 80 GB SSD | 2–5 s |
| Server — NVIDIA A100 | 64 GB | 40 GB | 200 GB NVMe | < 2 s |

**Model disk footprint:**

| Model | Size |
|---|---|
| `mistral:7b-instruct-q4_K_M` | 4.1 GB |
| `llama3.1:8b-instruct-q4_K_M` | 4.7 GB |
| `phi3:mini-instruct-q4` | 2.2 GB |
| `nomic-embed-text-v1.5` | 274 MB |
| `ms-marco-MiniLM-L-6-v2` | 90 MB |
| **Total** | **≈ 11.4 GB** |

**GPU requirements:** NVIDIA Container Toolkit must be installed on the host for GPU mode.
Use `docker-compose.cpu.yml` override on CPU-only hosts.

---

## 11. Acceptance Criteria

The system is **accepted** when all of the following pass on a clean Docker host:

### Infrastructure
- [ ] `docker compose up -d` starts all 10 services with exit code 0
- [ ] All services report `healthy` in `docker compose ps` within 120 seconds
- [ ] `infra/ollama/pull_models.sh` pulls all three LLM models to completion
- [ ] `scripts/healthcheck.py` reports all services online
- [ ] `docker compose down` removes all containers; `docker compose up` restores the full stack

### Data & Ingestion
- [ ] `scripts/seed_documents.py` inserts 12 document metadata records
- [ ] Admin UI successfully ingests a 20+ page PDF (e.g. Employment Act)
- [ ] Ingested document has ≥ 10 chunks with 768-dim embeddings in `document_chunks`
- [ ] Ingested document has BM25 index entries (keyword search returns results)

### Retrieval
- [ ] Hybrid search returns results for "termination of employment" within 10 seconds
- [ ] Vector and BM25 searches demonstrably run in parallel (verified in Langfuse trace)
- [ ] Metadata filter `doc_type=act` correctly restricts results
- [ ] `evaluate_retrieval.py` reports Recall@5 ≥ 0.65

### Agent System
- [ ] Router routes constitutional rights query to `CONSTITUTIONAL` agent
- [ ] Router routes Employment Act query to `STATUTE` agent
- [ ] Synthesis agent merges two specialist outputs into a single coherent response
- [ ] Every AI response includes the standard legal disclaimer

### Streaming & UI
- [ ] SSE stream emits `agent_start` → `routing` → `retrieval` → `token` (×N) → `sources` → `done`
- [ ] Chat UI renders tokens progressively as they stream
- [ ] Agent Thinking Panel updates in real time during a query
- [ ] Model name badge and "🔒 Processed Locally" visible on every AI message
- [ ] System Health Bar shows correct status for all services

### Security & Privacy
- [ ] No external API calls during any query (verified by T6 network isolation test)
- [ ] JWT auth protects all `/dashboard/*` routes
- [ ] `public` role is rate-limited to 10 queries/day
- [ ] `researcher` role cannot access `/admin/*` routes
- [ ] Passwords are bcrypt-hashed (verified by direct DB inspection)

### Observability
- [ ] Langfuse dashboard at `http://localhost:3001` shows traces after queries
- [ ] Every trace contains spans for routing, retrieval, generation, synthesis

---

## 12. Glossary

| Term | Definition |
|---|---|
| **Agent Zero** | Open-source hierarchical multi-agent framework (agent0ai/agent-zero) that this system's architecture is modelled on |
| **ELRI** | Eswatini Legal Research Intelligence — the name of this system |
| **Ollama** | Open-source local LLM server; exposes OpenAI-compatible REST API; images from `ollama/ollama` on Docker Hub |
| **TEI** | Text Embeddings Inference — HuggingFace's high-performance embedding and reranking server; images from `ghcr.io/huggingface/text-embeddings-inference` |
| **pgvector** | PostgreSQL extension for storing and querying vector embeddings |
| **ParadeDB** | PostgreSQL distribution that includes `pg_search` (BM25 full-text) and `pgvector`; image `paradedb/paradedb` |
| **BM25** | Best Match 25 — probabilistic lexical ranking algorithm used for keyword search |
| **RRF** | Reciprocal Rank Fusion — algorithm that merges multiple ranked lists: `score(d) = Σ 1/(k + rank_i(d))` |
| **HNSW** | Hierarchical Navigable Small World — graph-based approximate nearest-neighbour index used by pgvector |
| **Nomic Embed** | `nomic-ai/nomic-embed-text-v1.5` — 768-dim open-source embedding model; requires `search_query:` / `search_document:` prefixes |
| **Mistral 7B** | `mistral:7b-instruct-q4_K_M` — primary local LLM; strong instruction following; Q4 quantised for CPU/GPU |
| **Llama 3.1 8B** | `llama3.1:8b-instruct-q4_K_M` — synthesis LLM; 128k context window for long-form consolidation |
| **Phi-3 Mini** | `phi3:mini-instruct-q4` — lightweight router LLM; fast classification without occupying large VRAM |
| **LangGraph** | Python library for building stateful multi-agent graphs with typed state; used for agent orchestration |
| **Langfuse** | Self-hosted LLM observability platform; image `langfuse/langfuse`; no data sent to cloud |
| **Eswatini Citation** | Legal citation format: `[Act Name], [Year], s [section]([subsection])` e.g. `Employment Act, 1980, s 35(1)(b)` |
| **Air-gapped** | The system makes no outbound internet connections during operation; runs entirely on local network |
| **SSE** | Server-Sent Events — HTTP streaming protocol used to push real-time agent trace events from backend to frontend |

---

*ELRI — Eswatini Legal Research Intelligence*  
*Siyinqaba — We are the fortress.*  
*Built for the Kingdom of Eswatini. No data leaves the server.*
