'use client'

import { useState, useCallback, useRef } from 'react'
import { api, SSEEvent, Source, AgentTraceEvent } from '../api'
import { parseSSEStream } from '../api'

export interface StreamingChatState {
  tokens: string
  agentTrace: AgentTraceEvent[]
  sources: Source[]
  isStreaming: boolean
  error: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null
  disclaimer: string | null
}

export interface StreamingChatReturn extends StreamingChatState {
  submitQuery: (query: string, filters?: Record<string, unknown>) => Promise<void>
  reset: () => void
  cancel: () => void
}

const initialState: StreamingChatState = {
  tokens: '',
  agentTrace: [],
  sources: [],
  isStreaming: false,
  error: null,
  confidence: null,
  disclaimer: null,
}

export function useStreamingChat(): StreamingChatReturn {
  const [state, setState] = useState<StreamingChatState>(initialState)
  const cancelRef = useRef<(() => void) | null>(null)

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  const cancel = useCallback(() => {
    cancelRef.current?.()
    setState((prev) => ({ ...prev, isStreaming: false }))
  }, [])

  const submitQuery = useCallback(
    async (
      query: string,
      filters?: Record<string, unknown>
    ) => {
      setState(initialState)
      setState((prev) => ({ ...prev, isStreaming: true, error: null }))

      try {
        const response = await api.chat.stream(query, filters as Parameters<typeof api.chat.stream>[1])

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()

        const handleEvent = (event: SSEEvent) => {
          switch (event.type) {
            case 'agent_start':
              setState((prev) => ({
                ...prev,
                agentTrace: [
                  ...prev.agentTrace,
                  {
                    agent: event.agent || 'unknown',
                    action: event.message || 'Starting...',
                    status: 'active',
                  },
                ],
              }))
              break

            case 'routing':
              setState((prev) => ({
                ...prev,
                agentTrace: prev.agentTrace.map((trace, idx) =>
                  idx === prev.agentTrace.length - 1
                    ? { ...trace, action: `Routing to: ${event.agents?.join(', ')}`, status: 'completed' as const }
                    : trace
                ),
              }))
              break

            case 'retrieval':
              setState((prev) => ({
                ...prev,
                agentTrace: [
                  ...prev.agentTrace.filter((t) => t.status !== 'waiting'),
                  {
                    agent: event.agent || 'unknown',
                    action: `Found ${event.chunks_found} chunks`,
                    chunks_found: event.chunks_found,
                    top_score: event.top_score,
                    status: 'completed' as const,
                  },
                ],
              }))
              break

            case 'token':
              setState((prev) => ({
                ...prev,
                tokens: prev.tokens + (event.content || ''),
              }))
              break

            case 'sources':
              setState((prev) => ({
                ...prev,
                sources: event.sources || [],
              }))
              break

            case 'done':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                confidence: (event.confidence_level as 'HIGH' | 'MEDIUM' | 'LOW') || null,
                disclaimer: event.disclaimer || null,
              }))
              break

            case 'error':
              setState((prev) => ({
                ...prev,
                isStreaming: false,
                error: event.error || 'An error occurred',
              }))
              break
          }
        }

        const cleanup = parseSSEStream(
          reader,
          handleEvent,
          (error) => {
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: error.message,
            }))
          }
        )

        cancelRef.current = cleanup
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Failed to submit query',
        }))
      }
    },
    []
  )

  return {
    ...state,
    submitQuery,
    reset,
    cancel,
  }
}
