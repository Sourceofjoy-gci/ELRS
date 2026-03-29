export interface SSEEvent {
  type: string
  [key: string]: unknown
}

export function parseSSEStream<T extends SSEEvent = SSEEvent>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: T) => void,
  onError?: (error: Error) => void
): () => void {
  const decoder = new TextDecoder()
  let buffer = ''
  let isReading = false

  const read = () => {
    if (isReading) return
    isReading = true

    reader.read().then(({ done, value }) => {
      isReading = false

      if (done) {
        if (buffer.trim()) {
          try {
            const event = parseSSELine(buffer)
            if (event) onEvent(event as T)
          } catch (error) {
            onError?.(error as Error)
          }
        }
        return
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const event = parseSSELine(line)
        if (event) {
          try {
            onEvent(event as T)
          } catch (error) {
            onError?.(error as Error)
          }
        }
      }

      read()
    }).catch((error) => {
      isReading = false
      onError?.(error as Error)
    })
  }

  read()

  return () => {
    reader.cancel().catch(() => {})
  }
}

function parseSSELine(line: string): SSEEvent | null {
  const trimmed = line.trim()
  
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('data: ')) {
    const data = trimmed.slice(6)
    
    if (data === '[DONE]') {
      return { type: 'done' }
    }

    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  if (trimmed.startsWith('event: ')) {
    const eventType = trimmed.slice(7)
    return { type: eventType }
  }

  if (trimmed.startsWith('id: ')) {
    return { type: 'message', id: trimmed.slice(4) }
  }

  if (trimmed.startsWith('retry: ')) {
    return { type: 'retry', value: parseInt(trimmed.slice(7)) }
  }

  return null
}

export class SSEStreamManager {
  private streams: Map<string, () => void> = new Map()

  addStream(id: string, cleanup: () => void): void {
    this.streams.set(id, cleanup)
  }

  removeStream(id: string): void {
    const cleanup = this.streams.get(id)
    if (cleanup) {
      cleanup()
      this.streams.delete(id)
    }
  }

  removeAll(): void {
    this.streams.forEach((cleanup) => cleanup())
    this.streams.clear()
  }

  getStreamCount(): number {
    return this.streams.size
  }

  hasStream(id: string): boolean {
    return this.streams.has(id)
  }
}

export const sseStreamManager = new SSEStreamManager()
