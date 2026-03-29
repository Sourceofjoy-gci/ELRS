'use client'

import { useState, useEffect } from 'react'
import { api, HealthStatus } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'
import {
  Cpu,
  Database,
  HardDrive,
  Layers,
  Server,
  RefreshCw,
} from 'lucide-react'

interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'offline'
  detail?: string
  responseTime?: number
  icon: React.ReactNode
}

export function SystemHealthBar() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchHealth = async () => {
    try {
      const data = await api.health.models()
      setHealth(data)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 10000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: 'healthy' | 'degraded' | 'offline') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-amber-500'
      case 'offline':
        return 'bg-red-500'
    }
  }

  const getStatusBg = (status: 'healthy' | 'degraded' | 'offline') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
      case 'degraded':
        return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
      case 'offline':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
    }
  }

  if (loading && !health) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border p-4 w-80">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (error && !health) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border p-4 w-80">
        <p className="text-red-500 text-sm">{error}</p>
        <button
          onClick={fetchHealth}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  const services: ServiceHealth[] = [
    {
      name: 'Ollama LLM',
      status: health?.ollama?.status || 'offline',
      detail: health?.ollama?.primary_model,
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      name: 'Embeddings',
      status: health?.embeddings?.status || 'offline',
      detail: health?.embeddings?.model,
      icon: <Layers className="w-4 h-4" />,
    },
    {
      name: 'Reranker',
      status: health?.reranker?.status || 'offline',
      detail: health?.reranker?.model,
      icon: <Server className="w-4 h-4" />,
    },
    {
      name: 'PostgreSQL',
      status: health?.postgres?.status || 'offline',
      icon: <Database className="w-4 h-4" />,
    },
    {
      name: 'Redis',
      status: health?.redis?.status || 'offline',
      icon: <HardDrive className="w-4 h-4" />,
    },
  ]

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border p-4 w-96">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">System Health</h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              {formatTime(Date.now() - lastUpdated.getTime())} ago
            </span>
          )}
          <button
            onClick={fetchHealth}
            className={cn(
              'p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
              loading && 'animate-spin'
            )}
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {services.map((service) => (
          <div
            key={service.name}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border transition-colors',
              getStatusBg(service.status)
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm')}>
                {service.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {service.name}
                </p>
                {service.detail && (
                  <p className="text-xs text-gray-500 truncate max-w-48">
                    {service.detail}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('w-2.5 h-2.5 rounded-full', getStatusColor(service.status))} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
                {service.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Auto-refresh: 10s</span>
          <span>Last check: {lastUpdated?.toLocaleTimeString() || 'Never'}</span>
        </div>
      </div>
    </div>
  )
}
