import { cookies } from 'next/headers'
import type { SSEEvent, Source } from './utils'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ChatFilters {
  doc_type?: string[]
  year_min?: number
  year_max?: number
  ministry?: string
  status?: string
}

function getHeaders(): Record<string, string> {
  const cookieStore = cookies()
  const token = cookieStore.get('elri_auth_token')?.value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const chatApi = {
  stream: (
    query: string,
    filters?: ChatFilters,
  ) => {
    const params = new URLSearchParams({ query })
    if (filters?.doc_type?.length) {
      filters.doc_type.forEach((dt) => params.append('doc_type', dt))
    }
    if (filters?.year_min) params.set('year_min', String(filters.year_min))
    if (filters?.year_max) params.set('year_max', String(filters.year_max))
    if (filters?.ministry) params.set('ministry', filters.ministry)
    if (filters?.status) params.set('status', filters.status)

    const headers = getHeaders()
    headers['Accept'] = 'text/event-stream'

    return fetch(`${API_BASE_URL}/api/v1/chat/stream?${params}`, { headers })
  },

  sync: async (query: string, filters?: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ query, filters }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Chat sync failed: ${res.status}`)
    }
    return res.json() as Promise<{
      final_answer: string
      sources: Source[]
      confidence: string
      disclaimer: string
    }>
  },

  sessions: async (page = 1) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions?page=${page}`, {
      credentials: 'include',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
    return res.json() as Promise<{ sessions: unknown[]; total: number }>
  },

  session: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${id}`, {
      credentials: 'include',
      headers: getHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
    return res.json()
  },
}
