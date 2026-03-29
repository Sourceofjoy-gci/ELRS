import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getHeaders(): Record<string, string> {
  const cookieStore = cookies()
  const token = cookieStore.get('elri_auth_token')?.value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: getHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export interface HealthStatus {
  ollama: { status: string; primary_model?: string }
  embeddings: { status: string; model?: string }
  reranker: { status: string; model?: string }
  postgres: { status: string }
  redis: { status: string }
  minio: { status: string }
}

export const healthApi = {
  models: async () => request<HealthStatus>('/api/v1/health/models'),
  status: async () => request<{ status: string }>('/api/v1/health'),
}
