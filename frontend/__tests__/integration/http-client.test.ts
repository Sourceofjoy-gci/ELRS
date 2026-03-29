import { ApiError, isApiError, getErrorMessage, NetworkError, TimeoutError, ValidationError } from '../lib/integration/errors'

describe('ApiError', () => {
  describe('constructor', () => {
    it('creates error with message and status', () => {
      const error = new ApiError('Test error', 500)
      expect(error.message).toBe('Test error')
      expect(error.status).toBe(500)
      expect(error.name).toBe('ApiError')
    })

    it('creates error with body', () => {
      const body = { detail: 'Error details', code: 'TEST_ERROR' }
      const error = new ApiError('Test error', 400, body)
      expect(error.body).toEqual(body)
    })
  })

  describe('static factory methods', () => {
    it('creates network error', () => {
      const error = ApiError.networkError(new Error('Connection refused'))
      expect(error.status).toBe(0)
      expect(error.isNetworkError()).toBe(true)
    })

    it('creates timeout error', () => {
      const error = ApiError.timeoutError()
      expect(error.status).toBe(408)
      expect(error.isNetworkError()).toBe(false)
    })

    it('creates unauthorized error', () => {
      const error = ApiError.unauthorizedError()
      expect(error.status).toBe(401)
      expect(error.isUnauthorized()).toBe(true)
    })

    it('creates forbidden error', () => {
      const error = ApiError.forbiddenError()
      expect(error.status).toBe(403)
      expect(error.isForbidden()).toBe(true)
    })

    it('creates not found error', () => {
      const error = ApiError.notFoundError('Document')
      expect(error.status).toBe(404)
      expect(error.isNotFound()).toBe(true)
    })

    it('creates validation error', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ]
      const error = ApiError.validationError(errors)
      expect(error.status).toBe(422)
      expect(error.isValidationError()).toBe(true)
      expect(error.getFieldError('email')).toBe('Invalid email')
    })

    it('creates rate limit error', () => {
      const error = ApiError.rateLimitError(60)
      expect(error.status).toBe(429)
      expect(error.isRateLimitError()).toBe(true)
    })

    it('creates server error', () => {
      const error = ApiError.serverError()
      expect(error.status).toBe(500)
      expect(error.isServerError()).toBe(true)
    })
  })

  describe('error type checking', () => {
    it('identifies unauthorized errors', () => {
      const error = new ApiError('Unauthorized', 401)
      expect(error.isUnauthorized()).toBe(true)
      expect(error.isForbidden()).toBe(false)
    })

    it('identifies forbidden errors', () => {
      const error = new ApiError('Forbidden', 403)
      expect(error.isForbidden()).toBe(true)
      expect(error.isUnauthorized()).toBe(false)
    })

    it('identifies validation errors', () => {
      const error = new ApiError('Validation failed', 422)
      expect(error.isValidationError()).toBe(true)
    })

    it('identifies rate limit errors', () => {
      const error = new ApiError('Rate limited', 429)
      expect(error.isRateLimitError()).toBe(true)
    })

    it('identifies server errors', () => {
      const error = new ApiError('Server error', 500)
      expect(error.isServerError()).toBe(true)
    })

    it('identifies network errors', () => {
      const error = new ApiError('Network error', 0)
      expect(error.isNetworkError()).toBe(true)
    })
  })

  describe('field errors', () => {
    it('gets field error', () => {
      const error = ApiError.validationError([
        { field: 'email', message: 'Required' },
        { field: 'name', message: 'Too short' },
      ])
      expect(error.getFieldError('email')).toBe('Required')
      expect(error.getFieldError('name')).toBe('Too short')
      expect(error.getFieldError('missing')).toBeUndefined()
    })

    it('checks if field has error', () => {
      const error = ApiError.validationError([
        { field: 'email', message: 'Required' },
      ])
      expect(error.hasFieldError('email')).toBe(true)
      expect(error.hasFieldError('password')).toBe(false)
    })
  })

  describe('serialization', () => {
    it('converts to JSON', () => {
      const error = new ApiError('Test', 500, {
        detail: 'Server error',
        code: 'SERVER_ERROR',
      })
      const json = error.toJSON()
      expect(json.detail).toBe('Test')
      expect(json.code).toBe('SERVER_ERROR')
    })
  })
})

describe('isApiError', () => {
  it('returns true for ApiError', () => {
    const error = new ApiError('Test', 500)
    expect(isApiError(error)).toBe(true)
  })

  it('returns true for object with isApiError flag', () => {
    const error = { message: 'Test', isApiError: true }
    expect(isApiError(error)).toBe(true)
  })

  it('returns false for regular Error', () => {
    const error = new Error('Test')
    expect(isApiError(error)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isApiError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isApiError(undefined)).toBe(false)
  })

  it('returns false for plain objects', () => {
    expect(isApiError({ message: 'Test' })).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('extracts message from ApiError', () => {
    const error = new ApiError('Test error', 500, {
      detail: 'Server error occurred',
    })
    expect(getErrorMessage(error)).toBe('Server error occurred')
  })

  it('extracts message from regular Error', () => {
    const error = new Error('Something went wrong')
    expect(getErrorMessage(error)).toBe('Something went wrong')
  })

  it('returns default message for unknown error', () => {
    expect(getErrorMessage('string error')).toBe('An unexpected error occurred')
    expect(getErrorMessage(123)).toBe('An unexpected error occurred')
    expect(getErrorMessage({})).toBe('An unexpected error occurred')
  })
})

describe('NetworkError', () => {
  it('creates network error with default message', () => {
    const error = new NetworkError()
    expect(error.message).toBe('Network connection failed')
    expect(error.status).toBe(0)
    expect(error.isNetworkError()).toBe(true)
  })

  it('creates network error with custom message', () => {
    const error = new NetworkError('Cannot reach server')
    expect(error.message).toBe('Cannot reach server')
  })
})

describe('TimeoutError', () => {
  it('creates timeout error with default timeout', () => {
    const error = new TimeoutError()
    expect(error.message).toContain('30000ms')
    expect(error.status).toBe(408)
  })

  it('creates timeout error with custom timeout', () => {
    const error = new TimeoutError(5000)
    expect(error.message).toContain('5000ms')
  })
})

describe('ValidationError', () => {
  it('creates validation error with field errors', () => {
    const errors = {
      email: 'Invalid email format',
      password: 'Password must be at least 8 characters',
    }
    const error = new ValidationError(errors)
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toEqual(errors)
    expect(error.hasFieldError('email')).toBe(true)
  })
})

describe('AuthenticationError', () => {
  it('creates authentication error', () => {
    const error = new AuthenticationError()
    expect(error.status).toBe(401)
    expect(error.isUnauthorized()).toBe(true)
  })
})

describe('AuthorizationError', () => {
  it('creates authorization error', () => {
    const error = new AuthorizationError()
    expect(error.status).toBe(403)
    expect(error.isForbidden()).toBe(true)
  })
})
