import { getToken, clearToken, refreshToken, getRefreshToken, setToken, setRefreshToken } from '../auth'
import { ApiError, ApiErrorResponse } from './errors'

export interface RequestConfig {
  timeout?: number
  retries?: number
  retryDelay?: number
  headers?: Record<string, string>
}

export interface RetryConfig {
  maxRetries: number
  retryDelay: number
  retryCondition?: (error: ApiError) => boolean
}

const DEFAULT_TIMEOUT = 30000
const DEFAULT_RETRY_DELAY = 1000
const DEFAULT_MAX_RETRIES = 3

const retryableStatusCodes = [408, 429, 500, 502, 503, 504]

function isRetryableError(error: ApiError): boolean {
  if (retryableStatusCodes.includes(error.status)) {
    return true
  }
  if (error.status === 0 || error.message.includes('network') || error.message.includes('timeout')) {
    return true
  }
  return false
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function serializeRequestBody(body: unknown): BodyInit | null {
  if (body === null || body === undefined) {
    return null
  }
  if (body instanceof FormData) {
    return body
  }
  if (typeof body === 'string') {
    return body
  }
  return JSON.stringify(body)
}

function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    return response.json()
  }
  
  if (contentType.includes('text/')) {
    return response.text() as Promise<T>
  }
  
  return response.blob() as Promise<T>
}

export interface RequestInterceptor {
  onRequest: (config: RequestInit) => RequestInit | Promise<RequestInit>
  onRequestError?: (error: Error) => void
}

export interface ResponseInterceptor {
  onResponse: <T>(data: T) => T | Promise<T>
  onResponseError?: (error: ApiError) => void
}

export class HttpClient {
  private baseURL: string
  private defaultConfig: RequestConfig
  private retryConfig: RetryConfig
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []
  private abortControllers: Map<string, AbortController> = new Map()

  constructor(baseURL: string, defaultConfig: RequestConfig = {}) {
    this.baseURL = baseURL
    this.defaultConfig = {
      timeout: DEFAULT_TIMEOUT,
      retries: DEFAULT_MAX_RETRIES,
      retryDelay: DEFAULT_RETRY_DELAY,
      ...defaultConfig,
    }
    this.retryConfig = {
      maxRetries: this.defaultConfig.retries || DEFAULT_MAX_RETRIES,
      retryDelay: this.defaultConfig.retryDelay || DEFAULT_RETRY_DELAY,
      retryCondition: isRetryableError,
    }
  }

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor)
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor)
      if (index > -1) {
        this.requestInterceptors.splice(index, 1)
      }
    }
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor)
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor)
      if (index > -1) {
        this.responseInterceptors.splice(index, 1)
      }
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    config?: RequestConfig
  ): Promise<T> {
    const { timeout, retries, retryDelay, headers, ...fetchOptions } = {
      ...this.defaultConfig,
      ...config,
    }

    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.baseURL}${endpoint}`

    let requestInit: RequestInit = {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }

    for (const interceptor of this.requestInterceptors) {
      try {
        requestInit = await interceptor.onRequest(requestInit)
      } catch (error) {
        interceptor.onRequestError?.(error as Error)
        throw error
      }
    }

    const token = getToken()
    if (token) {
      requestInit.headers = {
        ...requestInit.headers,
        'Authorization': `Bearer ${token}`,
      }
    }

    if (requestInit.body && !(requestInit.body instanceof FormData)) {
      requestInit.body = serializeRequestBody(
        typeof requestInit.body === 'string' 
          ? JSON.parse(requestInit.body) 
          : requestInit.body
      )
    }

    const maxRetries = retries ?? this.retryConfig.maxRetries
    const currentRetryDelay = retryDelay ?? this.retryConfig.retryDelay
    let lastError: ApiError | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        timeout ?? DEFAULT_TIMEOUT
      )

      try {
        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorBody = await this.parseErrorResponse(response)
          const apiError = new ApiError(
            errorBody?.message || `HTTP error ${response.status}`,
            response.status,
            errorBody ?? undefined
          )

          if (response.status === 401 && attempt === 0) {
            const refreshed = await this.handleTokenRefresh()
            if (refreshed) {
              const token = getToken()
              requestInit.headers = {
                ...requestInit.headers as Record<string, string>,
                'Authorization': `Bearer ${token}`,
              }
              continue
            }
          }

          for (const interceptor of this.responseInterceptors) {
            try {
              interceptor.onResponseError?.(apiError)
            } catch {
              // Interceptor error handling
            }
          }

          throw apiError
        }

        const data = await parseResponse<T>(response)

        for (const interceptor of this.responseInterceptors) {
          try {
            return await interceptor.onResponse(data)
          } catch {
            // Interceptor error handling
          }
        }

        return data
      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new ApiError('Request timeout', 408)
        } else if (error instanceof ApiError) {
          lastError = error
          
          if (attempt < maxRetries && this.retryConfig.retryCondition?.(error)) {
            await delay(currentRetryDelay * Math.pow(2, attempt))
            continue
          }
        } else if (error instanceof Error) {
          lastError = new ApiError(error.message, 0)
          
          if (attempt < maxRetries) {
            await delay(currentRetryDelay * Math.pow(2, attempt))
            continue
          }
        }

        lastError = lastError || new ApiError('Unknown error', 0)
      }
    }

    throw lastError!
  }

  private async handleTokenRefresh(): Promise<boolean> {
    const refreshTokenValue = getRefreshToken()
    if (!refreshTokenValue) {
      clearToken()
      return false
    }

    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      })

      if (!response.ok) {
        clearToken()
        clearToken()
        return false
      }

      const data = await response.json()
      setToken(data.access_token)
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token)
      }
      return true
    } catch {
      clearToken()
      return false
    }
  }

  private async parseErrorResponse(response: Response): Promise<ApiErrorResponse | null> {
    try {
      return await response.json()
    } catch {
      return {
        detail: response.statusText,
      }
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, config)
  }

  async post<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: serializeRequestBody(body) as BodyInit,
    }, config)
  }

  async put<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: serializeRequestBody(body) as BodyInit,
    }, config)
  }

  async patch<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: serializeRequestBody(body) as BodyInit,
    }, config)
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, config)
  }

  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(requestId)
    }
  }

  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => controller.abort())
    this.abortControllers.clear()
  }
}

export const httpClient = new HttpClient(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  }
)

httpClient.addRequestInterceptor({
  onRequest: (config) => {
    config.headers = {
      ...config.headers as Record<string, string>,
      'X-Request-ID': crypto.randomUUID(),
      'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    }
    return config
  },
})

httpClient.addResponseInterceptor({
  onResponse: (data) => {
    return data
  },
  onResponseError: (error) => {
    if (error.status === 401) {
      console.warn('Unauthorized request - token may be expired')
    }
    throw error
  },
})

export default HttpClient
