'use client'

import { useState, useEffect, useCallback } from 'react'
import { ApiError, NetworkError, TimeoutError } from '../integration/errors'

interface NetworkState {
  isOnline: boolean
  wasOffline: boolean
}

interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  onRetry?: (attempt: number) => void
  shouldRetry?: (error: ApiError) => boolean
}

interface UseFetchOptions<T> extends RetryOptions {
  immediate?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: ApiError) => void
}

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
  })

  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ isOnline: true, wasOffline: true }))
    }

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return state
}

export function useRetryFetch<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
) {
  const { maxRetries = 3, retryDelay = 1000, onRetry, shouldRetry } = options
  const [state, setState] = useState<{
    data: T | null
    loading: boolean
    error: ApiError | null
  }>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null })

    let lastError: ApiError | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await fetchFn()
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        lastError = error instanceof ApiError ? error : new ApiError(
          error instanceof Error ? error.message : 'Unknown error',
          0
        )

        if (attempt < maxRetries) {
          const shouldRetryRequest = shouldRetry
            ? shouldRetry(lastError)
            : isRetryableError(lastError)

          if (shouldRetryRequest) {
            onRetry?.(attempt + 1)
            await delay(retryDelay * Math.pow(2, attempt))
          } else {
            break
          }
        }
      }
    }

    setState({ data: null, loading: false, error: lastError })
    throw lastError
  }, [fetchFn, maxRetries, retryDelay, onRetry, shouldRetry])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    execute,
    reset,
    retry: execute,
  }
}

export function useFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseFetchOptions<T> = {}
) {
  const { immediate = true, onSuccess, onError } = options
  const fetchState = useRetryFetch(fetchFn, options)

  useEffect(() => {
    if (immediate) {
      fetchState.execute()
        .then((data) => onSuccess?.(data))
        .catch((error) => onError?.(error as ApiError))
    }
  }, [immediate])

  return fetchState
}

export function useConcurrentRequests<T>() {
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Map<string, T>>(new Map())
  const [errors, setErrors] = useState<Map<string, ApiError>>(new Map())

  const addRequest = useCallback((id: string, promise: Promise<T>) => {
    setPending((prev) => new Set(prev).add(id))

    promise
      .then((data) => {
        setResults((prev) => new Map(prev).set(id, data))
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
      .catch((error) => {
        setErrors((prev) => new Map(prev).set(id, error as ApiError))
        setPending((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })

    return () => {
      setPending((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setResults((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      setErrors((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const clear = useCallback(() => {
    setPending(new Set())
    setResults(new Map())
    setErrors(new Map())
  }, [])

  return {
    pending,
    results,
    errors,
    addRequest,
    clear,
    isPending: pending.size > 0,
  }
}

function isRetryableError(error: ApiError): boolean {
  return error.status === 0 ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
