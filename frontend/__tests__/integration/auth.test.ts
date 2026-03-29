import { 
  getToken, 
  setToken, 
  clearToken, 
  getRefreshToken,
  setRefreshToken,
  getUser, 
  isAuthenticated, 
  isAdmin, 
  isResearcher, 
  getRole,
  isTokenExpired,
  getTokenExpiration,
  isTokenExpiringSoon 
} from '../../lib/auth'

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

function createToken(payload: object, expired = false): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  
  let expPayload = { ...payload }
  if (expired) {
    expPayload.exp = Math.floor(Date.now() / 1000) - 3600
  } else if (payload) {
    expPayload.exp = Math.floor(Date.now() / 1000) + 3600
  }
  
  const payloadEncoded = btoa(JSON.stringify(expPayload))
  const signature = 'signature'
  
  return `${header}.${payloadEncoded}.${signature}`
}

describe('Auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getToken / setToken', () => {
    it('returns token from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('test-token')
      expect(getToken()).toBe('test-token')
    })

    it('returns null when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      expect(getToken()).toBeNull()
    })

    it('stores token in localStorage', () => {
      setToken('new-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('elri_auth_token', 'new-token')
    })
  })

  describe('getRefreshToken / setRefreshToken', () => {
    it('returns refresh token from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('refresh-token')
      expect(getRefreshToken()).toBe('refresh-token')
    })

    it('stores refresh token in localStorage', () => {
      setRefreshToken('new-refresh-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('elri_refresh_token', 'new-refresh-token')
    })
  })

  describe('clearToken', () => {
    it('removes tokens from localStorage', () => {
      clearToken()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('elri_auth_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('elri_refresh_token')
    })
  })

  describe('getUser', () => {
    it('decodes and returns user from token', () => {
      const token = createToken({
        sub: 'user-123',
        role: 'admin',
        email: 'test@example.com',
      })
      mockLocalStorage.getItem.mockReturnValue(token)

      const user = getUser()
      
      expect(user).not.toBeNull()
      expect(user?.sub).toBe('user-123')
      expect(user?.role).toBe('admin')
    })

    it('returns null for expired token', () => {
      const token = createToken({ sub: 'user-123', role: 'researcher' }, true)
      mockLocalStorage.getItem.mockReturnValue(token)

      const user = getUser()
      
      expect(user).toBeNull()
    })

    it('returns null for invalid token', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-token')

      const user = getUser()
      
      expect(user).toBeNull()
    })

    it('returns null when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const user = getUser()
      
      expect(user).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('returns true when valid token exists', () => {
      const token = createToken({ sub: 'user-123', role: 'researcher' })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isAuthenticated()).toBe(true)
    })

    it('returns false when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      expect(isAuthenticated()).toBe(false)
    })

    it('returns false for expired token', () => {
      const token = createToken({ sub: 'user-123' }, true)
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isAuthenticated()).toBe(false)
    })
  })

  describe('role checks', () => {
    it('isAdmin returns true for admin role', () => {
      const token = createToken({ sub: 'user-123', role: 'admin' })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isAdmin()).toBe(true)
      expect(isResearcher()).toBe(true)
    })

    it('isResearcher returns true for researcher role', () => {
      const token = createToken({ sub: 'user-123', role: 'researcher' })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isAdmin()).toBe(false)
      expect(isResearcher()).toBe(true)
    })

    it('isAdmin returns false for public role', () => {
      const token = createToken({ sub: 'user-123', role: 'public' })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isAdmin()).toBe(false)
      expect(isResearcher()).toBe(false)
    })
  })

  describe('getRole', () => {
    it('returns user role', () => {
      const token = createToken({ sub: 'user-123', role: 'researcher' })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(getRole()).toBe('researcher')
    })

    it('returns null when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      expect(getRole()).toBeNull()
    })
  })

  describe('isTokenExpired', () => {
    it('returns true for expired token', () => {
      const token = createToken({ sub: 'user-123' }, true)
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isTokenExpired()).toBe(true)
    })

    it('returns false for valid token', () => {
      const token = createToken({ sub: 'user-123' })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isTokenExpired()).toBe(false)
    })

    it('returns true for missing token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      expect(isTokenExpired()).toBe(true)
    })
  })

  describe('getTokenExpiration', () => {
    it('returns expiration date', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600
      const token = createToken({ sub: 'user-123', exp: futureTime })
      mockLocalStorage.getItem.mockReturnValue(token)

      const expiration = getTokenExpiration()
      
      expect(expiration).toBeInstanceOf(Date)
    })

    it('returns null for missing token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      expect(getTokenExpiration()).toBeNull()
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('returns true when token expires soon', () => {
      const soon = Math.floor(Date.now() / 1000) + 60
      const token = createToken({ sub: 'user-123', exp: soon })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isTokenExpiringSoon(5)).toBe(true)
    })

    it('returns false when token has plenty of time', () => {
      const later = Math.floor(Date.now() / 1000) + 7200
      const token = createToken({ sub: 'user-123', exp: later })
      mockLocalStorage.getItem.mockReturnValue(token)

      expect(isTokenExpiringSoon(5)).toBe(false)
    })
  })
})
