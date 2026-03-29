export interface ApiErrorResponse {
  detail?: string
  message?: string
  code?: string
  errors?: Array<{
    field: string
    message: string
  }>
}

export class ApiError extends Error {
  public readonly status: number
  public readonly body?: ApiErrorResponse
  public readonly isApiError: boolean = true

  constructor(
    message: string,
    status: number,
    body?: ApiErrorResponse
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    Error.captureStackTrace(this, this.constructor)
  }

  static fromResponse(response: Response, body?: ApiErrorResponse): ApiError {
    const message = body?.detail || body?.message || `HTTP Error ${response.status}`
    return new ApiError(message, response.status, body)
  }

  static networkError(cause: Error): ApiError {
    const error = new ApiError(
      `Network error: ${cause.message}`,
      0,
      { detail: 'Unable to connect to the server. Please check your internet connection.' }
    )
    return error
  }

  static timeoutError(): ApiError {
    return new ApiError(
      'Request timed out. Please try again.',
      408,
      { detail: 'The server took too long to respond.' }
    )
  }

  static unauthorizedError(message = 'Authentication required'): ApiError {
    return new ApiError(message, 401, { detail: message })
  }

  static forbiddenError(message = 'Access denied'): ApiError {
    return new ApiError(message, 403, { detail: message })
  }

  static notFoundError(resource = 'Resource'): ApiError {
    return new ApiError(`${resource} not found`, 404, { detail: `${resource} not found.` })
  }

  static validationError(errors: ApiErrorResponse['errors']): ApiError {
    return new ApiError('Validation failed', 422, {
      detail: 'Please check your input and try again.',
      errors,
    })
  }

  static rateLimitError(retryAfter?: number): ApiError {
    const message = retryAfter
      ? `Too many requests. Please try again in ${retryAfter} seconds.`
      : 'Too many requests. Please try again later.'
    return new ApiError(message, 429, {
      detail: message,
      code: 'RATE_LIMIT_EXCEEDED',
    })
  }

  static serverError(message = 'Internal server error'): ApiError {
    return new ApiError(message, 500, {
      detail: 'Something went wrong on our end. Please try again later.',
    })
  }

  static serviceUnavailable(): ApiError {
    return new ApiError(
      'Service temporarily unavailable',
      503,
      { detail: 'The service is temporarily unavailable. Please try again later.' }
    )
  }

  getFieldError(field: string): string | undefined {
    return this.body?.errors?.find((e) => e.field === field)?.message
  }

  hasFieldError(field: string): boolean {
    return !!this.getFieldError(field)
  }

  getErrorCode(): string | undefined {
    return this.body?.code
  }

  isUnauthorized(): boolean {
    return this.status === 401
  }

  isForbidden(): boolean {
    return this.status === 403
  }

  isNotFound(): boolean {
    return this.status === 404
  }

  isValidationError(): boolean {
    return this.status === 422
  }

  isRateLimitError(): boolean {
    return this.status === 429
  }

  isServerError(): boolean {
    return this.status >= 500
  }

  isNetworkError(): boolean {
    return this.status === 0
  }

  toJSON(): ApiErrorResponse {
    return {
      detail: this.message,
      code: this.body?.code,
      errors: this.body?.errors,
    }
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failed') {
    super(message, 0, {
      detail: 'Unable to connect to the server. Please check your internet connection.',
    })
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends ApiError {
  constructor(timeout = 30000) {
    super(
      `Request timed out after ${timeout}ms`,
      408,
      { detail: 'The server took too long to respond. Please try again.' }
    )
    this.name = 'TimeoutError'
  }
}

export class ValidationError extends ApiError {
  public readonly fieldErrors: Record<string, string>

  constructor(
    fieldErrors: Record<string, string>,
    message = 'Validation failed'
  ) {
    const errors = Object.entries(fieldErrors).map(([field, message]) => ({
      field,
      message,
    }))
    super(message, 422, { detail: message, errors })
    this.name = 'ValidationError'
    this.fieldErrors = fieldErrors
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, { detail: message })
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, { detail: message })
    this.name = 'AuthorizationError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError || 
    (typeof error === 'object' && error !== null && 'isApiError' in error)
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.body?.detail || error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}
