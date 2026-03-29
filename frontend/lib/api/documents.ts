import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getHeaders(): Record<string, string> {
  const cookieStore = cookies()
  const token = cookieStore.get('elri_auth_token')?.value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> || {}),
      ...getHeaders(),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export interface Document {
  id: string
  title: string
  doc_type: string
  status: string
  created_at: string
  updated_at: string
}

export interface CorpusStats {
  acts_indexed: number
  statutory_instruments: number
  constitutional_sections: number
  last_updated: string
}

export const documentsApi = {
  list: async (params?: {
    doc_type?: string
    year_min?: number
    year_max?: number
    ministry?: string
    status?: string
    q?: string
    page?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.doc_type) searchParams.set('doc_type', params.doc_type)
    if (params?.year_min) searchParams.set('year_min', String(params.year_min))
    if (params?.year_max) searchParams.set('year_max', String(params.year_max))
    if (params?.ministry) searchParams.set('ministry', params.ministry)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.q) searchParams.set('q', params.q)
    if (params?.page) searchParams.set('page', String(params.page))
    return request<{ documents: Document[]; total: number; stats?: CorpusStats }>(
      `/api/v1/documents?${searchParams}`
    )
  },

  get: async (id: string) => {
    return request<Document & { chunks: unknown[] }>(`/api/v1/documents/${id}`)
  },

  ingest: async (data: FormData) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: getHeaders(),
      body: data,
    })
    if (!res.ok) throw new Error(`Ingest failed: ${res.status}`)
    return res.json()
  },

  ingestJobs: async () => {
    return request<{ jobs: unknown[] }>('/api/v1/ingest/jobs')
  },
}
