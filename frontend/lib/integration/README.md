# Integration Layer Documentation

## Overview

The frontend integration layer provides a comprehensive solution for communicating with the backend API, handling authentication, managing network errors, and maintaining application state synchronization.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Components                          │
├─────────────────────────────────────────────────────────────────┤
│                     Custom Hooks (use*)                          │
│  useAuth | useNetworkStatus | useRetryFetch | useConcurrentReq  │
├─────────────────────────────────────────────────────────────────┤
│                      Service Layer                               │
│  authService | documentService | chatService | healthService    │
├─────────────────────────────────────────────────────────────────┤
│                     HTTP Client                                  │
│  httpClient (with interceptors, retry, timeout)                 │
├─────────────────────────────────────────────────────────────────┤
│                     Error Handling                               │
│  ApiError | ErrorBoundary | Error Recovery                      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### HTTP Client (`lib/integration/http-client.ts`)

The central HTTP client with enterprise-grade features:

- **Timeout Management**: Configurable request timeouts (default: 30s)
- **Retry Logic**: Automatic retry with exponential backoff for:
  - Network failures (status 0)
  - Server errors (5xx)
  - Rate limiting (429)
  - Timeouts (408)
- **Request Interceptors**: Transform requests before sending
- **Response Interceptors**: Transform responses before returning
- **Authentication**: Automatic Bearer token injection
- **Token Refresh**: Automatic token refresh on 401 responses

```typescript
import { httpClient } from '@/lib/integration'

const data = await httpClient.get<User>('/api/users/1')
const result = await httpClient.post('/api/users', { name: 'John' })
```

### Service Layer

#### Auth Service (`lib/integration/auth-service.ts`)
- `login(email, password)` - Authenticate user
- `register(data)` - Create new account
- `getProfile()` - Get current user profile
- `refreshToken()` - Refresh access token
- `logout()` - Clear authentication
- `hasRole(role)` - Check user permissions

#### Document Service (`lib/integration/services.ts`)
- `list(filters, page)` - List documents with pagination
- `getById(id)` - Get document details with chunks
- `getChunks(documentId)` - Get document sections
- `search(query, filters)` - Search documents
- `ingest(file, metadata)` - Upload and process document

#### Chat Service (`lib/integration/chat-service.ts`)
- `streamChat(query, options)` - Stream chat response with SSE
- `syncChat(query, filters)` - Get synchronous chat response
- `listSessions()` - List chat sessions
- `getSession(id)` - Get session details
- `cancelStream()` - Cancel active stream

#### Health Service (`lib/integration/health-service.ts`)
- `checkHealth()` - Get system health status
- `checkDetailedHealth()` - Get detailed health with response times
- `getOverallStatus()` - Get overall system status

### Error Handling (`lib/integration/errors.ts`)

Comprehensive error types and utilities:

```typescript
import { ApiError, isApiError, getErrorMessage } from '@/lib/integration/errors'

try {
  await api.getUser()
} catch (error) {
  if (isApiError(error)) {
    if (error.isUnauthorized()) {
      // Handle 401
    } else if (error.isValidationError()) {
      const fieldError = error.getFieldError('email')
    }
  }
}
```

### Error Boundaries (`lib/hooks/useErrorHandler.tsx`)

React error boundaries for graceful error recovery:

```tsx
import { ErrorBoundary } from '@/lib/hooks'

<ErrorBoundary onError={(error) => logError(error)}>
  <MyComponent />
</ErrorBoundary>
```

### Custom Hooks

#### useAuth
```tsx
import { useAuth } from '@/lib/hooks'

function MyComponent() {
  const { isAuthenticated, isAdmin, login, logout } = useAuth()
  
  if (!isAuthenticated) return <Login />
  return <Dashboard />
}
```

#### useNetworkStatus
```tsx
import { useNetworkStatus } from '@/lib/hooks'

function MyComponent() {
  const { isOnline, wasOffline } = useNetworkStatus()
  
  if (!isOnline) return <OfflineBanner />
  return <OnlineContent />
}
```

#### useRetryFetch
```tsx
import { useRetryFetch } from '@/lib/hooks'

function MyComponent() {
  const { data, loading, error, execute } = useRetryFetch(
    () => fetchData(),
    { maxRetries: 3, retryDelay: 1000 }
  )
}
```

#### useConcurrentRequests
```tsx
import { useConcurrentRequests } from '@/lib/hooks'

function MyComponent() {
  const { pending, results, addRequest } = useConcurrentRequests()
  
  const fetchUsers = () => addRequest('users', api.getUsers())
  const fetchDocs = () => addRequest('docs', api.getDocs())
}
```

## Security Features

### Token Management
- Access tokens stored in memory (via localStorage for SSR)
- Refresh tokens for extended sessions
- Automatic token refresh on 401
- Token expiration checking

### Request Security
- X-Request-ID for request tracing
- X-Client-Version header
- Authorization header injection
- CORS-aware configuration

### Sensitive Data
- No sensitive data in URLs
- FormData for file uploads
- Secure header configuration

## Testing

Comprehensive integration tests cover:

- HTTP client methods (GET, POST, PUT, DELETE)
- Error handling and recovery
- Retry logic
- Authentication flow
- Interceptor execution
- Content type handling

Run tests with:
```bash
npm run test:integration
```

## Configuration

Environment variables:
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:8000)
- `NEXT_PUBLIC_APP_VERSION` - App version for headers

## Best Practices

1. **Always use services** instead of raw httpClient
2. **Handle errors** with try/catch and ApiError
3. **Use Error Boundaries** for component-level error recovery
4. **Leverage hooks** for common patterns
5. **Configure timeouts** appropriately for long operations
6. **Monitor network status** for offline support
