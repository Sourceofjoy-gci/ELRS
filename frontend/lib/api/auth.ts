import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name?: string
  organisation?: string
}

export interface User {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'researcher' | 'public'
  organisation?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

async function fetchWithCookie(url: string, init?: RequestInit): Promise<Response> {
  const cookieStore = cookies()
  const token = cookieStore.get('elri_auth_token')?.value
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return fetch(url, { ...init, headers })
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Login failed: ${res.status}`)
    }
    return res.json()
  },

  register: async (data: RegisterRequest): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Registration failed: ${res.status}`)
    }
    return res.json()
  },

  me: async (): Promise<User> => {
    const res = await fetchWithCookie(`${API_BASE_URL}/api/v1/auth/me`)
    if (!res.ok) throw new Error(`Failed to get user: ${res.status}`)
    return res.json()
  },
}
