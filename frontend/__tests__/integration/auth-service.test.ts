import { httpClient, HttpClient, RequestConfig } from '../lib/integration/http-client'
import { ApiError } from '../lib/integration/errors'

const mockFetch = jest.fn()
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

global.fetch = mockFetch

describe('HttpClient', () => {
  let client: HttpClient

  beforeEach(() => {
    jest.clearAllMocks()
    client = new HttpClient('http://localhost:8000', {
      timeout: 5000,
      retries: 2,
      retryDelay: 100,
    })
  })

  describe('basic HTTP methods', () => {
    it('makes GET request', async () => {
      const mockData = { id: 1, name: 'Test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockData),
      })

      const result = await client.get<typeof mockData>('/api/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({ method: 'GET' }),
        expect.any(Object)
      )
      expect(result).toEqual(mockData)
    })

    it('makes POST request with body', async () => {
      const mockData = { id: 1, success: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockData),
      })

      const result = await client.post<typeof mockData>('/api/test', { name: 'Test' })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        }),
        expect.any(Object)
      )
      expect(result).toEqual(mockData)
    })

    it('makes PUT request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      })

      await client.put('/api/test', { name: 'Updated' })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({ method: 'PUT' }),
        expect.any(Object)
      )
    })

    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(null),
      })

      await client.delete('/api/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({ method: 'DELETE' }),
        expect.any(Object)
      )
    })
  })

  describe('error handling', () => {
    it('throws ApiError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ detail: 'Not found' }),
      })

      await expect(client.get('/api/test')).rejects.toThrow(ApiError)
    })

    it('throws ApiError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.get('/api/test')).rejects.toThrow(ApiError)
    })

    it('throws ApiError on timeout', async () => {
      const controller = {
        signal: { aborted: false },
        abort: jest.fn(),
      }
      
      jest.useFakeTimers()
      
      mockFetch.mockImplementation(() => {
        return new Promise((_, __) => {
          setTimeout(() => {}, 6000)
        })
      })

      const promise = client.get('/api/test', { timeout: 1000 })
      
      jest.advanceTimersByTime(1000)
      
      await expect(promise).rejects.toThrow()
      
      jest.useRealTimers()
    })
  })

  describe('retry logic', () => {
    it('retries on 500 error', async () => {
      const mockData = { success: true }
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ detail: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockData),
        })

      const result = await client.get<typeof mockData>('/api/test', {
        retries: 1,
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockData)
    })

    it('does not retry on 400 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ detail: 'Bad request' }),
      })

      await expect(client.get('/api/test', { retries: 3 })).rejects.toThrow()

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('authentication', () => {
    it('includes auth token when available', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      })

      await client.get('/api/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
        expect.any(Object)
      )
    })

    it('does not include auth token when not available', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      })

      await client.get('/api/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
        expect.any(Object)
      )
    })
  })

  describe('interceptors', () => {
    it('executes request interceptor', async () => {
      const interceptor = {
        onRequest: jest.fn((config) => ({
          ...config,
          headers: { ...config.headers, 'X-Custom': 'header' },
        })),
      }

      client.addRequestInterceptor(interceptor)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      })

      await client.get('/api/test')

      expect(interceptor.onRequest).toHaveBeenCalled()
    })

    it('executes response interceptor', async () => {
      const interceptor = {
        onResponse: jest.fn((data) => ({ ...data, transformed: true })),
      }

      client.addResponseInterceptor(interceptor)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ original: true }),
      })

      const result = await client.get<{ original: boolean; transformed: boolean }>('/api/test')

      expect(interceptor.onResponse).toHaveBeenCalled()
      expect(result.transformed).toBe(true)
    })
  })

  describe('content type handling', () => {
    it('handles JSON response', async () => {
      const mockData = { test: 'data' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockData),
      })

      const result = await client.get('/api/test')
      expect(result).toEqual(mockData)
    })

    it('handles text response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('plain text'),
      })

      const result = await client.get<string>('/api/test')
      expect(result).toBe('plain text')
    })

    it('handles FormData body', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      })

      await client.post('/api/upload', formData)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: formData,
        }),
        expect.any(Object)
      )
    })
  })
})
