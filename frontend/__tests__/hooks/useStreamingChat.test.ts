import { useStreamingChat } from '@/lib/hooks/useStreamingChat'
import { renderHook, act } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  api: {
    chat: {
      stream: jest.fn(),
    },
  },
}))

describe('useStreamingChat hook', () => {
  const mockApi = require('@/lib/api').api

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useStreamingChat())

    expect(result.current.tokens).toBe('')
    expect(result.current.agentTrace).toEqual([])
    expect(result.current.sources).toEqual([])
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useStreamingChat())

    await act(async () => {
      result.current.reset()
    })

    expect(result.current.tokens).toBe('')
    expect(result.current.agentTrace).toEqual([])
    expect(result.current.sources).toEqual([])
  })

  it('cancel stops streaming', async () => {
    const mockCancel = jest.fn()
    mockApi.chat.stream.mockReturnValue({
      body: {
        getReader: () => ({
          read: jest.fn().mockResolvedValue({ done: true }),
          cancel: mockCancel,
        }),
      },
    })

    const { result } = renderHook(() => useStreamingChat())

    await act(async () => {
      await result.current.submitQuery('test query')
    })

    await act(async () => {
      result.current.cancel()
    })

    expect(mockCancel).toHaveBeenCalled()
  })

  it('handles API errors gracefully', async () => {
    mockApi.chat.stream.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useStreamingChat())

    await act(async () => {
      await result.current.submitQuery('test query')
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.isStreaming).toBe(false)
  })

  it('handles missing response body', async () => {
    mockApi.chat.stream.mockResolvedValue({
      body: null,
    })

    const { result } = renderHook(() => useStreamingChat())

    await act(async () => {
      await result.current.submitQuery('test query')
    })

    expect(result.current.error).toBe('Failed to submit query')
  })
})
