const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
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
      if (done) return

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

      if (!done) read()
    }).catch((error) => {
      onError?.(error as Error)
    })
  }

  read()

  return () => {
    reader.cancel().catch(() => {})
  }
}
