import { httpClient } from './http-client'

export interface OllamaStatus {
  status: 'healthy' | 'degraded' | 'offline'
  primary_model?: string
  primary_loaded?: boolean
  fallback_model?: string
  fallback_loaded?: boolean
  router_model?: string
  router_loaded?: boolean
}

export interface TEIStatus {
  status: 'healthy' | 'degraded' | 'offline'
  model?: string
  dimensions?: number
}

export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'offline'
}

export interface HealthStatus {
  ollama: OllamaStatus
  embeddings: TEIStatus
  reranker: TEIStatus
  postgres: ServiceStatus
  redis: ServiceStatus
  minio: ServiceStatus
}

export interface HealthCheckResult {
  healthy: boolean
  responseTime: number
  status: HealthStatus
  timestamp: Date
}

class HealthService {
  private readonly baseEndpoint = '/api/v1/health'
  private lastHealthStatus: HealthStatus | null = null
  private lastCheckTime: Date | null = null
  private healthCache: Map<string, { status: HealthStatus; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5000

  async checkHealth(forceRefresh = false): Promise<HealthStatus> {
    if (!forceRefresh && this.lastHealthStatus && this.lastCheckTime) {
      const elapsed = Date.now() - this.lastCheckTime.getTime()
      if (elapsed < this.CACHE_TTL) {
        return this.lastHealthStatus
      }
    }

    try {
      const status = await httpClient.get<HealthStatus>(`${this.baseEndpoint}/models`, {
        timeout: 5000,
      })
      
      this.lastHealthStatus = status
      this.lastCheckTime = new Date()
      
      return status
    } catch {
      return this.getOfflineStatus()
    }
  }

  async checkDetailedHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now()
    
    try {
      const status = await this.checkHealth()
      const responseTime = performance.now() - startTime
      
      return {
        healthy: this.isHealthy(status),
        responseTime,
        status,
        timestamp: new Date(),
      }
    } catch {
      return {
        healthy: false,
        responseTime: performance.now() - startTime,
        status: this.getOfflineStatus(),
        timestamp: new Date(),
      }
    }
  }

  async checkIndividualService(service: keyof HealthStatus): Promise<{
    status: 'healthy' | 'degraded' | 'offline'
    responseTime: number
  }> {
    const startTime = performance.now()
    
    try {
      await this.checkHealth()
      const responseTime = performance.now() - startTime
      
      return {
        status: this.lastHealthStatus?.[service]?.status || 'offline',
        responseTime,
      }
    } catch {
      return {
        status: 'offline',
        responseTime: performance.now() - startTime,
      }
    }
  }

  private isHealthy(status: HealthStatus): boolean {
    return Object.values(status).every(
      (service) => service.status === 'healthy' || service.status === 'degraded'
    )
  }

  private getOfflineStatus(): HealthStatus {
    return {
      ollama: { status: 'offline' },
      embeddings: { status: 'offline' },
      reranker: { status: 'offline' },
      postgres: { status: 'offline' },
      redis: { status: 'offline' },
      minio: { status: 'offline' },
    }
  }

  getLastStatus(): HealthStatus | null {
    return this.lastHealthStatus
  }

  getLastCheckTime(): Date | null {
    return this.lastCheckTime
  }

  isOllamaHealthy(): boolean {
    return this.lastHealthStatus?.ollama?.status !== 'offline'
  }

  isEmbeddingServiceHealthy(): boolean {
    return this.lastHealthStatus?.embeddings?.status !== 'offline'
  }

  isRerankerHealthy(): boolean {
    return this.lastHealthStatus?.reranker?.status !== 'offline'
  }

  isDatabaseHealthy(): boolean {
    return this.lastHealthStatus?.postgres?.status !== 'offline'
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'offline' {
    if (!this.lastHealthStatus) return 'offline'
    
    const allOffline = Object.values(this.lastHealthStatus).every(
      (s) => s.status === 'offline'
    )
    if (allOffline) return 'offline'
    
    const anyDegraded = Object.values(this.lastHealthStatus).some(
      (s) => s.status === 'degraded'
    )
    if (anyDegraded) return 'degraded'
    
    return 'healthy'
  }
}

export const healthService = new HealthService()
export default HealthService
