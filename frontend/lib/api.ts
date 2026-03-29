import { getToken } from './auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Document {
  id: string
  title: string
  doc_type: 'act' | 'statutory_instrument' | 'constitution' | 'bill' | 'case_law' | 'regulation' | 'gazette'
  act_number?: string
  year?: number
  chapter?: string
  ministry?: string
  status: 'active' | 'repealed' | 'amended' | 'draft'
  commencement_date?: string
  file_path?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  section_heading?: string
  section_number?: string
  part_heading?: string
  chapter_heading?: string
  token_count?: number
  metadata?: Record<string, unknown>
}

export interface Source {
  id: string
  act_name: string
  act_number?: string
  year?: number
  doc_type: string
  section_number?: string
  section_heading?: string
  chunk_excerpt: string
  reranker_score: number
  document_id: string
}

export interface AgentTraceEvent {
  agent: string
  action: string
  chunks_found?: number
  top_score?: number
  latency_ms?: number
  model_used?: string
  status: 'active' | 'completed' | 'waiting'
}

export interface HealthStatus {
  ollama: {
    status: 'healthy' | 'degraded' | 'offline'
    primary_model?: string
    primary_loaded?: boolean
    fallback_model?: string
    fallback_loaded?: boolean
    router_model?: string
    router_loaded?: boolean
  }
  embeddings: {
    status: 'healthy' | 'degraded' | 'offline'
    model?: string
    dimensions?: number
  }
  reranker: {
    status: 'healthy' | 'degraded' | 'offline'
    model?: string
  }
  postgres: {
    status: 'healthy' | 'degraded' | 'offline'
  }
  redis: {
    status: 'healthy' | 'degraded' | 'offline'
  }
  minio: {
    status: 'healthy' | 'degraded' | 'offline'
  }
}

export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'researcher' | 'public'
  organisation?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  agent_trace?: AgentTraceEvent[]
  sources?: Source[]
  model_used?: string
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  created_at?: string
}

export interface Session {
  id: string
  session_title?: string
  model_used?: string
  created_at: string
  messages?: ChatMessage[]
}

export interface CorpusStats {
  acts_indexed: number
  statutory_instruments: number
  constitutional_sections: number
  last_updated: string
}

export interface IngestionJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  document_id?: string
  error?: string
  created_at: string
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      body.detail || `Request failed with status ${response.status}`,
      response.status,
      body
    )
  }
  
  return response.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; token_type: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: { email: string; password: string; full_name?: string; organisation?: string }) =>
      request<{ message: string }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<User>('/api/v1/auth/me'),
  },

  chat: {
    stream: (
      query: string,
      filters?: {
        doc_type?: string[]
        year_min?: number
        year_max?: number
        ministry?: string
        status?: string
      },
      onEvent?: (event: SSEEvent) => void
    ) => {
      const token = getToken()
      const params = new URLSearchParams({ query })
      if (filters?.doc_type?.length) {
        filters.doc_type.forEach((dt) => params.append('doc_type', dt))
      }
      if (filters?.year_min) params.set('year_min', String(filters.year_min))
      if (filters?.year_max) params.set('year_max', String(filters.year_max))
      if (filters?.ministry) params.set('ministry', filters.ministry)
      if (filters?.status) params.set('status', filters.status)

      return fetch(`${API_BASE_URL}/api/v1/chat/stream?${params}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: 'text/event-stream',
        },
      })
    },
    sync: (query: string, filters?: Record<string, unknown>) =>
      request<{
        final_answer: string
        sources: Source[]
        confidence: string
        disclaimer: string
      }>('/api/v1/chat/sync', {
        method: 'POST',
        body: JSON.stringify({ query, filters }),
      }),
    sessions: (page = 1) =>
      request<{ sessions: Session[]; total: number }>(
        `/api/v1/chat/sessions?page=${page}`
      ),
    session: (id: string) => request<Session>(`/api/v1/chat/sessions/${id}`),
  },

  documents: {
    list: (params?: {
      doc_type?: string
      year_min?: number
      year_max?: number
      ministry?: string
      status?: string
      q?: string
      stats?: boolean
      page?: number
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.doc_type) searchParams.set('doc_type', params.doc_type)
      if (params?.year_min) searchParams.set('year_min', String(params.year_min))
      if (params?.year_max) searchParams.set('year_max', String(params.year_max))
      if (params?.ministry) searchParams.set('ministry', params.ministry)
      if (params?.status) searchParams.set('status', params.status)
      if (params?.q) searchParams.set('q', params.q)
      if (params?.stats) searchParams.set('stats', 'true')
      if (params?.page) searchParams.set('page', String(params.page))
      
      return request<{ documents: Document[]; total: number; stats?: CorpusStats }>(
        `/api/v1/documents?${searchParams}`
      )
    },
    get: (id: string) => request<Document & { chunks: DocumentChunk[] }>(`/api/v1/documents/${id}`),
    ingest: (data: FormData) =>
      fetch(`${API_BASE_URL}/api/v1/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: data,
      }),
    ingestJobs: () => request<{ jobs: IngestionJob[] }>('/api/v1/ingest/jobs'),
  },

  search: {
    query: (query: string, filters?: Record<string, unknown>) =>
      request<{ chunks: DocumentChunk[]; scores: number[] }>('/api/v1/search', {
        method: 'POST',
        body: JSON.stringify({ query, filters }),
      }),
  },

  health: {
    models: () => request<HealthStatus>('/api/v1/health/models'),
    status: () => request<{ status: string }>('/api/v1/health'),
  },

  admin: {
    pullModel: (model: string) =>
      fetch(`${API_BASE_URL}/api/v1/admin/pull-model`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model }),
      }),
  },
}

export interface SSEEvent {
  type: 'agent_start' | 'routing' | 'retrieval' | 'token' | 'sources' | 'done' | 'error'
  agent?: string
  message?: string
  agents?: string[]
  reasoning?: string
  confidence?: number
  chunks_found?: number
  top_score?: number
  content?: string
  sources?: Source[]
  disclaimer?: string
  confidence_level?: string
  error?: string
}

export function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void
): () => void {
  const decoder = new TextDecoder()
  let buffer = ''

  const read = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            onEvent(data)
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      if (!done) {
        read()
      }
    }).catch((error) => {
      onError?.(error as Error)
    })
  }

  read()

  return () => {
    reader.cancel().catch(() => {})
  }
}

export { ApiError }
