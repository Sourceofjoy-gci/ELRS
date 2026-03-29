import { getToken, setToken, clearToken, getUser, isAuthenticated, isAdmin, isResearcher, getRole } from '@/lib/auth'

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('getToken', () => {
    it('returns null when no token exists', () => {
      expect(getToken()).toBeNull()
    })

    it('returns token when it exists', () => {
      localStorageMock.getItem.mockReturnValue('test-token')
      expect(getToken()).toBe('test-token')
    })
  })

  describe('setToken', () => {
    it('stores token in localStorage', () => {
      setToken('new-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('elri_auth_token', 'new-token')
    })
  })

  describe('clearToken', () => {
    it('removes token from localStorage', () => {
      clearToken()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('elri_auth_token')
    })
  })

  describe('getUser', () => {
    it('returns null when no token', () => {
      expect(getUser()).toBeNull()
    })

    it('returns null for invalid token', () => {
      localStorageMock.getItem.mockReturnValue('invalid-token')
      expect(getUser()).toBeNull()
    })

    it('returns null for expired token', () => {
      const expiredPayload = btoa(JSON.stringify({
        sub: 'user-123',
        role: 'researcher',
        exp: Math.floor(Date.now() / 1000) - 3600,
      }))
      localStorageMock.getItem.mockReturnValue(`header.${expiredPayload}.signature`)
      expect(getUser()).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('returns false when no token', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('returns true when valid token exists', () => {
      const validPayload = btoa(JSON.stringify({
        sub: 'user-123',
        role: 'researcher',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }))
      localStorageMock.getItem.mockReturnValue(`header.${validPayload}.signature`)
      expect(isAuthenticated()).toBe(true)
    })
  })

  describe('role checks', () => {
    const createToken = (role: string) => {
      const payload = btoa(JSON.stringify({
        sub: 'user-123',
        role,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }))
      return `header.${payload}.signature`
    }

    it('isAdmin returns true for admin role', () => {
      localStorageMock.getItem.mockReturnValue(createToken('admin'))
      expect(isAdmin()).toBe(true)
    })

    it('isAdmin returns false for researcher role', () => {
      localStorageMock.getItem.mockReturnValue(createToken('researcher'))
      expect(isAdmin()).toBe(false)
    })

    it('isResearcher returns true for researcher role', () => {
      localStorageMock.getItem.mockReturnValue(createToken('researcher'))
      expect(isResearcher()).toBe(true)
    })

    it('isResearcher returns true for admin role', () => {
      localStorageMock.getItem.mockReturnValue(createToken('admin'))
      expect(isResearcher()).toBe(true)
    })

    it('isResearcher returns false for public role', () => {
      localStorageMock.getItem.mockReturnValue(createToken('public'))
      expect(isResearcher()).toBe(false)
    })

    it('getRole returns correct role', () => {
      localStorageMock.getItem.mockReturnValue(createToken('admin'))
      expect(getRole()).toBe('admin')
    })
  })
})
