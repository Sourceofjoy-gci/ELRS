import { httpClient } from './http-client'
import { ApiError } from './errors'
import { parseSSEStream } from './sse-stream'

export interface Source {
  id: string
  act_name: string
  act_number?: string
  year?: number
  doc_type: string
  section_number?: string
  section_heading?: string
  part_heading?: string
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
  [key: string]: unknown
}

export interface ChatFilters {
  doc_type?: string[]
  year_min?: number
  year_max?: number
  ministry?: string
  status?: string
}

export interface ChatSession {
  id: string
  session_title?: string
  model_used?: string
  created_at: string
  updated_at?: string
  messages_count?: number
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'agent'
  content: string
  agent_trace?: AgentTraceEvent[]
  sources?: Source[]
  model_used?: string
  tokens_used?: number
  latency_ms?: number
  confidence?: string
  created_at: string
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[]
}

export interface ChatSyncResponse {
  final_answer: string
  sources: Source[]
  confidence: string
  disclaimer: string
  agent_trace: AgentTraceEvent[]
}

export interface ChatStreamOptions {
  filters?: ChatFilters
  onEvent: (event: SSEEvent) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

class ChatService {
  private readonly baseEndpoint = '/api/v1/chat'
  private activeStreams: Map<string, AbortController> = new Map()

  async streamChat(
    query: string,
    options: ChatStreamOptions
  ): Promise<() => void> {
    const streamId = crypto.randomUUID()
    const controller = new AbortController()
    this.activeStreams.set(streamId, controller)

    const params = new URLSearchParams({ query })

    if (options.filters?.doc_type?.length) {
      options.filters.doc_type.forEach((dt) => params.append('doc_type', dt))
    }
    if (options.filters?.year_min) params.set('year_min', String(options.filters.year_min))
    if (options.filters?.year_max) params.set('year_max', String(options.filters.year_max))
    if (options.filters?.ministry) params.set('ministry', options.filters.ministry)
    if (options.filters?.status) params.set('status', options.filters.status)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${this.baseEndpoint}/stream?${params}`,
        {
          headers: {
            'Accept': 'text/event-stream',
            'Authorization': `Bearer ${localStorage.getItem('elri_auth_token') || ''}`,
          },
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw ApiError.fromResponse(response, body)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()

      const cleanup = parseSSEStream<SSEEvent>(
        reader,
        (event) => {
          options.onEvent(event)
          if (event.type === 'done' || event.type === 'error') {
            options.onComplete?.()
          }
        },
        (error) => {
          options.onError?.(error)
          options.onComplete?.()
        }
      )

      return () => {
        controller.abort()
        this.activeStreams.delete(streamId)
        cleanup()
      }
    } catch (error) {
      this.activeStreams.delete(streamId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        options.onComplete?.()
        return () => {}
      }
      
      options.onError?.(error instanceof Error ? error : new Error(String(error)))
      options.onComplete?.()
      throw error
    }
  }

  async syncChat(
    query: string,
    filters?: ChatFilters
  ): Promise<ChatSyncResponse> {
    const body: Record<string, unknown> = { query }

    if (filters) {
      body.filters = filters
    }

    try {
      return await httpClient.post<ChatSyncResponse>(
        `${this.baseEndpoint}/sync`,
        body,
        { timeout: 120000 }
      )
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError('Failed to get chat response', 500)
    }
  }

  async listSessions(page = 1, pageSize = 20): Promise<{
    sessions: ChatSession[]
    total: number
  }> {
    return httpClient.get<{ sessions: ChatSession[]; total: number }>(
      `${this.baseEndpoint}/sessions?page=${page}&page_size=${pageSize}`
    )
  }

  async getSession(sessionId: string): Promise<ChatSessionDetail> {
    try {
      return await httpClient.get<ChatSessionDetail>(
        `${this.baseEndpoint}/sessions/${sessionId}`
      )
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound()) {
        throw new ApiError('Session not found', 404)
      }
      throw error
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await httpClient.delete(`${this.baseEndpoint}/sessions/${sessionId}`)
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound()) {
        throw new ApiError('Session not found', 404)
      }
      throw error
    }
  }

  async updateSessionTitle(
    sessionId: string,
    title: string
  ): Promise<ChatSession> {
    try {
      return await httpClient.patch<ChatSession>(
        `${this.baseEndpoint}/sessions/${sessionId}`,
        { session_title: title }
      )
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound()) {
        throw new ApiError('Session not found', 404)
      }
      throw error
    }
  }

  cancelStream(streamId?: string): void {
    if (streamId) {
      const controller = this.activeStreams.get(streamId)
      if (controller) {
        controller.abort()
        this.activeStreams.delete(streamId)
      }
    } else {
      this.activeStreams.forEach((controller) => controller.abort())
      this.activeStreams.clear()
    }
  }

  cancelAllStreams(): void {
    this.cancelStream()
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size
  }
}

export const chatService = new ChatService()
export default ChatService
