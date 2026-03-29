import { decodeJwt, JWTPayload } from 'jose'

export interface UserJWTPayload extends JWTPayload {
  sub: string
  role: 'admin' | 'researcher' | 'public'
  exp?: number
  iat?: number
}

const COOKIE_NAME = 'elri_auth_token'

/**
 * Get the auth token from the HTTP-only cookie.
 * Works on both server (via cookies()) and client (via document.cookie).
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') {
    // Server-side: not available in server components without async cookies()
    // For synchronous server contexts, return null
    return null
  }
  // Client-side: read from HTTP-only cookie
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${COOKIE_NAME}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

/**
 * Trigger a page reload after the server sets the HTTP-only cookie.
 * Called after login to refresh the page state.
 */
export function setToken(_token: string): void {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

/**
 * Clear the auth cookie by setting Max-Age=0.
 */
export function clearToken(): void {
  if (typeof window === 'undefined') {
    // Server-side: need async cookies API — use clearTokenAsync instead
    return
  }
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

/**
 * Decode and return the current user from the token cookie.
 * Returns null if no token or expired.
 */
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
    return null
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null
}

export function isAdmin(): boolean {
  return getUser()?.role === 'admin'
}

export function isResearcher(): boolean {
  const role = getUser()?.role
  return role === 'researcher' || role === 'admin'
}

export function getRole(): 'admin' | 'researcher' | 'public' | null {
  return getUser()?.role ?? null
}

export function getUserId(): string | null {
  return getUser()?.sub ?? null
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
