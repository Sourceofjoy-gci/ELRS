import { httpClient, RequestConfig } from './http-client'
import { ApiError } from './errors'
import { 
  setToken, 
  clearToken, 
  getToken, 
  getUser, 
  getRefreshToken,
  setRefreshToken,
  isAuthenticated,
  getRole 
} from '../auth'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name?: string
  organisation?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  refresh_token?: string
  expires_in?: number
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: 'admin' | 'researcher' | 'public'
  organisation?: string
  created_at: string
  updated_at: string
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirm {
  token: string
  new_password: string
}

class AuthService {
  private readonly baseEndpoint = '/api/v1/auth'

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await httpClient.post<AuthResponse>(
        `${this.baseEndpoint}/login`,
        credentials,
        { timeout: 10000 }
      )
      
      if (response.access_token) {
        setToken(response.access_token)
        if (response.refresh_token) {
          setRefreshToken(response.refresh_token)
        }
      }
      
      return response
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized()) {
        throw new ApiError(
          'Invalid email or password',
          401,
          { detail: 'Please check your credentials and try again.' }
        )
      }
      throw error
    }
  }

  async register(data: RegisterRequest): Promise<{ message: string }> {
    try {
      const response = await httpClient.post<{ message: string }>(
        `${this.baseEndpoint}/register`,
        data,
        { timeout: 15000 }
      )
      return response
    } catch (error) {
      if (error instanceof ApiError && error.isValidationError()) {
        const fieldErrors: Record<string, string> = {}
        error.body?.errors?.forEach((e) => {
          fieldErrors[e.field] = e.message
        })
        throw error
      }
      throw error
    }
  }

  async getProfile(): Promise<UserProfile> {
    if (!isAuthenticated()) {
      throw new ApiError('Not authenticated', 401)
    }

    try {
      return await httpClient.get<UserProfile>(`${this.baseEndpoint}/me`)
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized()) {
        this.logout()
      }
      throw error
    }
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      return false
    }

    try {
      const response = await httpClient.post<AuthResponse>(
        `${this.baseEndpoint}/refresh`,
        { refresh_token: refreshToken },
        { timeout: 10000 }
      )

      if (response.access_token) {
        setToken(response.access_token)
        if (response.refresh_token) {
          setRefreshToken(response.refresh_token)
        }
        return true
      }
      return false
    } catch {
      this.logout()
      return false
    }
  }

  async requestPasswordReset(request: PasswordResetRequest): Promise<{ message: string }> {
    try {
      return await httpClient.post<{ message: string }>(
        `${this.baseEndpoint}/password-reset`,
        request,
        { timeout: 10000 }
      )
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound()) {
        throw new ApiError(
          'Email address not found',
          404,
          { detail: 'No account found with this email address.' }
        )
      }
      throw error
    }
  }

  async confirmPasswordReset(data: PasswordResetConfirm): Promise<{ message: string }> {
    try {
      return await httpClient.post<{ message: string }>(
        `${this.baseEndpoint}/password-reset/confirm`,
        data,
        { timeout: 10000 }
      )
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized()) {
        throw new ApiError(
          'Invalid or expired reset token',
          401,
          { detail: 'The password reset link has expired. Please request a new one.' }
        )
      }
      throw error
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      return await httpClient.post<{ message: string }>(
        `${this.baseEndpoint}/change-password`,
        { old_password: oldPassword, new_password: newPassword },
        { timeout: 10000 }
      )
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized()) {
        throw new ApiError(
          'Current password is incorrect',
          401,
          { detail: 'Please enter your current password correctly.' }
        )
      }
      throw error
    }
  }

  logout(): void {
    clearToken()
  }

  isLoggedIn(): boolean {
    return isAuthenticated()
  }

  getCurrentUser() {
    return getUser()
  }

  hasRole(role: 'admin' | 'researcher' | 'public'): boolean {
    const currentRole = getRole()
    if (!currentRole) return false

    const roleHierarchy = {
      public: 0,
      researcher: 1,
      admin: 2,
    }

    return roleHierarchy[currentRole] >= roleHierarchy[role]
  }

  isAdmin(): boolean {
    return this.hasRole('admin')
  }

  isResearcher(): boolean {
    return this.hasRole('researcher')
  }
}

export const authService = new AuthService()
export default AuthService
