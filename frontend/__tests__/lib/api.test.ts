import { parseSSEStream, SSEEvent } from '@/lib/api'

describe('parseSSEStream', () => {
  const createMockReader = (chunks: string[]): ReadableStreamDefaultReader<Uint8Array> => {
    let index = 0
    const encoder = new TextEncoder()
    
    return {
      read: jest.fn().mockImplementation(() => {
        if (index >= chunks.length) {
          return Promise.resolve({ done: true, value: undefined })
        }
        const chunk = encoder.encode(chunks[index])
        index++
        return Promise.resolve({ done: false, value: chunk })
      }),
      releaseLock: jest.fn(),
      cancel: jest.fn(),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>
  }

  it('parses agent_start event', async () => {
    const mockReader = createMockReader(['data: {"type":"agent_start","agent":"router","message":"Starting"}\n'])
    const onEvent = jest.fn()
    const onError = jest.fn()

    parseSSEStream(mockReader, onEvent, onError)

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onEvent).toHaveBeenCalledWith({
      type: 'agent_start',
      agent: 'router',
      message: 'Starting',
    })
  })

  it('parses routing event', async () => {
    const mockReader = createMockReader([
      'data: {"type":"routing","agents":["STATUTE"],"reasoning":"Test","confidence":0.9}\n'
    ])
    const onEvent = jest.fn()

    parseSSEStream(mockReader, onEvent, jest.fn())

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onEvent).toHaveBeenCalledWith({
      type: 'routing',
      agents: ['STATUTE'],
      reasoning: 'Test',
      confidence: 0.9,
    })
  })

  it('parses token event', async () => {
    const mockReader = createMockReader([
      'data: {"type":"token","content":"Hello"}\n'
    ])
    const onEvent = jest.fn()

    parseSSEStream(mockReader, onEvent, jest.fn())

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onEvent).toHaveBeenCalledWith({
      type: 'token',
      content: 'Hello',
    })
  })

  it('parses sources event', async () => {
    const sources = [{ id: '1', act_name: 'Test' }]
    const mockReader = createMockReader([
      `data: {"type":"sources","sources":${JSON.stringify(sources)}}\n`
    ])
    const onEvent = jest.fn()

    parseSSEStream(mockReader, onEvent, jest.fn())

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onEvent).toHaveBeenCalledWith({
      type: 'sources',
      sources,
    })
  })

  it('parses done event', async () => {
    const mockReader = createMockReader([
      'data: {"type":"done","disclaimer":"Test","confidence_level":"HIGH"}\n'
    ])
    const onEvent = jest.fn()

    parseSSEStream(mockReader, onEvent, jest.fn())

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onEvent).toHaveBeenCalledWith({
      type: 'done',
      disclaimer: 'Test',
      confidence_level: 'HIGH',
    })
  })

  it('ignores malformed JSON', async () => {
    const mockReader = createMockReader([
      'data: not valid json\n'
    ])
    const onEvent = jest.fn()

    parseSSEStream(mockReader, onEvent, jest.fn())

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onEvent).not.toHaveBeenCalled()
  })

  it('calls onError on stream error', async () => {
    const mockReader = {
      read: jest.fn().mockRejectedValue(new Error('Stream error')),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>
    const onError = jest.fn()

    parseSSEStream(mockReader, jest.fn(), onError)

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(onError).toHaveBeenCalledWith(new Error('Stream error'))
  })
})
