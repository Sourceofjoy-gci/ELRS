import { decodeJwt, JWTPayload } from 'jose'

export interface UserJWTPayload extends JWTPayload {
  sub: string
  role: 'admin' | 'researcher' | 'public'
  exp?: number
  iat?: number
}

const ACCESS_TOKEN_KEY = 'elri_auth_token'
const REFRESH_TOKEN_KEY = 'elri_refresh_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function refreshToken(): string | null {
  const token = getRefreshToken()
  if (!token) return null

  try {
    const payload = decodeJwt(token) as UserJWTPayload

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      clearToken()
      return null
    }

    return token
  } catch {
    clearToken()
    return null
  }
}

export function getUser(): UserJWTPayload | null {
  const token = getToken()
  if (!token) return null

  try {
    const payload = decodeJwt(token) as UserJWTPayload

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      clearToken()
      return null
    }

    return payload
  } catch {
    clearToken()
    return null
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null
}

export function isAdmin(): boolean {
  const user = getUser()
  return user?.role === 'admin'
}

export function isResearcher(): boolean {
  const user = getUser()
  return user?.role === 'researcher' || user?.role === 'admin'
}

export function getRole(): 'admin' | 'researcher' | 'public' | null {
  const user = getUser()
  return user?.role || null
}

export function getUserId(): string | null {
  const user = getUser()
  return user?.sub || null
}

export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true

  try {
    const payload = decodeJwt(token) as UserJWTPayload

    if (!payload.exp) return false

    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

export function getTokenExpiration(): Date | null {
  const token = getToken()
  if (!token) return null

  try {
    const payload = decodeJwt(token) as UserJWTPayload

    if (!payload.exp) return null

    return new Date(payload.exp * 1000)
  } catch {
    return null
  }
}

export function isTokenExpiringSoon(thresholdMinutes = 5): boolean {
  const expiration = getTokenExpiration()
  if (!expiration) return true

  const threshold = thresholdMinutes * 60 * 1000
  return Date.now() + threshold >= expiration.getTime()
}
