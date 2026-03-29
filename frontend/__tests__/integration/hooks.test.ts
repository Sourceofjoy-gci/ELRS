import { renderHook, act, waitFor } from '@testing-library/react'
import { useNetworkStatus, useRetryFetch, useFetch, useConcurrentRequests } from '../../lib/hooks/useNetworkStatus'
import { ApiError } from '../../lib/integration/errors'

const mockAddEventListener = jest.fn()
const mockRemoveEventListener = jest.fn()

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true,
})

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true,
})

Object.defineProperty(window.navigator, 'onLine', {
  value: true,
  writable: true,
})

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns initial online status', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: true })
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(true)
  })

  it('detects offline status', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false })
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(false)
  })

  it('sets up event listeners', () => {
    renderHook(() => useNetworkStatus())
    
    expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus())
    unmount()
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})

describe('useRetryFetch', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('executes fetch function', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useRetryFetch(fetchFn))

    await act(async () => {
      result.current.execute()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual({ data: 'test' })
      expect(result.current.loading).toBe(false)
    })
  })

  it('handles errors', async () => {
    const error = new ApiError('Test error', 500)
    const fetchFn = jest.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useRetryFetch(fetchFn, { maxRetries: 0 }))

    await act(async () => {
      try {
        await result.current.execute()
      } catch (e) {
        expect(e).toBe(error)
      }
    })

    await waitFor(() => {
      expect(result.current.error).toBe(error)
      expect(result.current.loading).toBe(false)
    })
  })

  it('retries on error', async () => {
    jest.useFakeTimers()
    
    const fetchFn = jest.fn()
      .mockRejectedValueOnce(new ApiError('Server error', 500))
      .mockResolvedValueOnce({ data: 'success' })

    const { result } = renderHook(() => useRetryFetch(fetchFn, {
      maxRetries: 1,
      retryDelay: 100,
    }))

    await act(async () => {
      result.current.execute()
    })

    await act(async () => {
      await Promise.resolve()
    })

    jest.advanceTimersByTime(100)

    await waitFor(() => {
      expect(result.current.data).toEqual({ data: 'success' })
    })

    jest.useRealTimers()
  })

  it('resets state', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useRetryFetch(fetchFn))

    await act(async () => {
      result.current.execute()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual({ data: 'test' })
    })

    await act(async () => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})

describe('useFetch', () => {
  it('fetches immediately by default', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useFetch(fetchFn))

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled()
    })
  })

  it('does not fetch immediately when disabled', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    renderHook(() => useFetch(fetchFn, { immediate: false }))

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('calls onSuccess callback', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' })
    const onSuccess = jest.fn()
    renderHook(() => useFetch(fetchFn, { onSuccess }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ data: 'test' })
    })
  })

  it('calls onError callback', async () => {
    const error = new ApiError('Test error', 500)
    const fetchFn = jest.fn().mockRejectedValue(error)
    const onError = jest.fn()
    renderHook(() => useFetch(fetchFn, { onError, maxRetries: 0 }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error)
    })
  })
})

describe('useConcurrentRequests', () => {
  it('adds request and tracks pending', async () => {
    const { result } = renderHook(() => useConcurrentRequests<{ id: string }>())

    const promise = new Promise<{ id: string }>((resolve) => {
      setTimeout(() => resolve({ id: '1' }), 100)
    })

    await act(async () => {
      result.current.addRequest('req-1', promise)
    })

    expect(result.current.pending.has('req-1')).toBe(true)
    expect(result.current.isPending).toBe(true)
  })

  it('stores result on success', async () => {
    const { result } = renderHook(() => useConcurrentRequests<{ id: string }>())

    const promise = Promise.resolve({ id: '1' })

    await act(async () => {
      result.current.addRequest('req-1', promise)
    })

    await waitFor(() => {
      expect(result.current.results.get('req-1')).toEqual({ id: '1' })
      expect(result.current.pending.has('req-1')).toBe(false)
    })
  })

  it('stores error on failure', async () => {
    const { result } = renderHook(() => useConcurrentRequests<{ id: string }>())

    const error = new ApiError('Test error', 500)
    const promise = Promise.reject(error)

    await act(async () => {
      result.current.addRequest('req-1', promise)
    })

    await waitFor(() => {
      expect(result.current.errors.get('req-1')).toBe(error)
    })
  })

  it('clears all requests', async () => {
    const { result } = renderHook(() => useConcurrentRequests<{ id: string }>())

    const promise1 = Promise.resolve({ id: '1' })
    const promise2 = Promise.resolve({ id: '2' })

    await act(async () => {
      result.current.addRequest('req-1', promise1)
      result.current.addRequest('req-2', promise2)
    })

    await act(async () => {
      result.current.clear()
    })

    expect(result.current.pending.size).toBe(0)
    expect(result.current.results.size).toBe(0)
    expect(result.current.errors.size).toBe(0)
  })
})
