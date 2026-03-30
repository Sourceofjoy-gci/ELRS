-- ELRI PostgreSQL Initialization Script
-- Creates all required extensions and tables for the Eswatini Legal Research Intelligence system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users and RBAC
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'researcher',
    organisation    VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Legal document registry
CREATE TABLE IF NOT EXISTS legal_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               TEXT NOT NULL,
    doc_type            VARCHAR(100) NOT NULL,
    act_number          VARCHAR(100),
    year                INTEGER,
    chapter             VARCHAR(50),
    ministry            VARCHAR(255),
    status              VARCHAR(50) DEFAULT 'active',
    commencement_date   DATE,
    source_url          TEXT,
    file_path           TEXT,
    raw_text            TEXT,
    doc_metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with 768-dim embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id         UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    chunk_index         INTEGER NOT NULL,
    content             TEXT NOT NULL,
    section_heading     TEXT,
    section_number      VARCHAR(100),
    part_heading        TEXT,
    chapter_heading     TEXT,
    token_count         INTEGER,
    embedding           vector(768),
    chunk_metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast ANN search
CREATE INDEX IF NOT EXISTS document_chunks_hnsw_idx
    ON document_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN trigram indexes for keyword search
CREATE INDEX IF NOT EXISTS document_chunks_content_gin_idx
    ON document_chunks USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS document_chunks_heading_gin_idx
    ON document_chunks USING gin (section_heading gin_trgm_ops);

-- Chat sessions
CREATE TABLE IF NOT EXISTS query_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    session_title   TEXT,
    model_used      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages with agent trace
CREATE TABLE IF NOT EXISTS query_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID REFERENCES query_sessions(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    agent_trace     JSONB DEFAULT '[]',
    sources         JSONB DEFAULT '[]',
    model_used      VARCHAR(100),
    tokens_used     INTEGER,
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion job tracking
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID REFERENCES legal_documents(id),
    status          VARCHAR(50) DEFAULT 'pending',
    error_message   TEXT,
    chunks_created  INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS access_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    document_id     UUID REFERENCES legal_documents(id),
    action          VARCHAR(50),
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Agent model mapping configuration
CREATE TABLE IF NOT EXISTS agent_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name      VARCHAR(50) UNIQUE NOT NULL,
    model_name      VARCHAR(100) NOT NULL,
    temperature     FLOAT DEFAULT 0.1,
    max_tokens      INTEGER DEFAULT 4096,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default agent configurations
INSERT INTO agent_config (agent_name, model_name, temperature, max_tokens) VALUES
    ('router', 'phi3:mini-instruct-q4', 0.1, 512),
    ('statute', 'mistral:7b-instruct-q4_K_M', 0.1, 4096),
    ('constitutional', 'mistral:7b-instruct-q4_K_M', 0.1, 4096),
    ('case_law', 'mistral:7b-instruct-q4_K_M', 0.1, 4096),
    ('comparison', 'mistral:7b-instruct-q4_K_M', 0.1, 4096),
    ('synthesis', 'llama3.1:8b-instruct-q4_K_M', 0.1, 8192)
ON CONFLICT (agent_name) DO NOTHING;
