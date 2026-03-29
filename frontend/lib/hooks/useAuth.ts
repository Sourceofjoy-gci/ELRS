'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { authService } from '../integration/auth-service'
import { ApiError, AuthenticationError } from '../integration/errors'

interface UseAuthState {
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  isResearcher: boolean
  error: ApiError | null
  user: {
    id: string
    email: string
    role: 'admin' | 'researcher' | 'public'
    full_name?: string
    organisation?: string
  } | null
}

export function useAuth() {
  const [state, setState] = useState<UseAuthState>({
    isAuthenticated: false,
    isLoading: true,
    isAdmin: false,
    isResearcher: false,
    error: null,
    user: null,
  })

  const initialized = useRef(false)

  const initialize = useCallback(async () => {
    if (initialized.current) return
    initialized.current = true

    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      if (authService.isLoggedIn()) {
        const profile = await authService.getProfile()
        setState({
          isAuthenticated: true,
          isLoading: false,
          isAdmin: profile.role === 'admin',
          isResearcher: profile.role === 'researcher' || profile.role === 'admin',
          error: null,
          user: profile,
        })
      } else {
        setState({
          isAuthenticated: false,
          isLoading: false,
          isAdmin: false,
          isResearcher: false,
          error: null,
          user: null,
        })
      }
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isResearcher: false,
        error: error instanceof ApiError ? error : new ApiError('Authentication failed', 500),
        user: null,
      })
    }
  }, [])

  useEffect(() => {
    initialize()
  }, [initialize])

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      await authService.login({ email, password })
      const profile = await authService.getProfile()
      setState({
        isAuthenticated: true,
        isLoading: false,
        isAdmin: profile.role === 'admin',
        isResearcher: profile.role === 'researcher' || profile.role === 'admin',
        error: null,
        user: profile,
      })
      return profile
    } catch (error) {
      const apiError = error instanceof ApiError 
        ? error 
        : new ApiError('Login failed', 500)
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: apiError,
      }))
      
      throw apiError
    }
  }, [])

  const register = useCallback(async (data: {
    email: string
    password: string
    full_name?: string
    organisation?: string
  }) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      await authService.register(data)
      setState((prev) => ({ ...prev, isLoading: false }))
      return { success: true }
    } catch (error) {
      const apiError = error instanceof ApiError 
        ? error 
        : new ApiError('Registration failed', 500)
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: apiError,
      }))
      
      throw apiError
    }
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setState({
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
      isResearcher: false,
      error: null,
      user: null,
    })
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authService.getProfile()
      setState((prev) => ({
        ...prev,
        user: profile,
        isAdmin: profile.role === 'admin',
        isResearcher: profile.role === 'researcher' || profile.role === 'admin',
      }))
      return profile
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logout()
      }
      throw error
    }
  }, [logout])

  return {
    ...state,
    login,
    register,
    logout,
    refreshProfile,
    initialize,
  }
}
