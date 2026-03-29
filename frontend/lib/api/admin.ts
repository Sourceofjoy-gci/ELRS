import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getHeaders(): Record<string, string> {
  const cookieStore = cookies()
  const token = cookieStore.get('elri_auth_token')?.value
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const adminApi = {
  pullModel: async (model: string) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/pull-model`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ model }),
    })
    if (!res.ok) throw new Error(`Failed to pull model: ${res.status}`)
    return res.json()
  },
}
