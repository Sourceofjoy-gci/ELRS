'use client'

import { useState, useEffect } from 'react'
import { api, HealthStatus } from '@/lib/api'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  Cpu,
  Database,
  HardDrive,
  Layers,
  Server,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react'

const AVAILABLE_MODELS = [
  { id: 'mistral:7b-instruct-q4_K_M', name: 'Mistral 7B', description: 'Primary legal reasoning model' },
  { id: 'llama3.1:8b-instruct-q4_K_M', name: 'Llama 3.1 8B', description: 'Synthesis model with 128k context' },
  { id: 'phi3:mini-instruct-q4', name: 'Phi-3 Mini', description: 'Fast router model' },
  { id: 'qwen2.5:7b-instruct-q4_K_M', name: 'Qwen 2.5 7B', description: 'Alternative reasoning model' },
  { id: 'gemma2:9b-instruct-q4_K_M', name: 'Gemma 2 9B', description: 'Alternative synthesis model' },
]

interface ServiceInfo {
  name: string
  status: 'healthy' | 'degraded' | 'offline'
  detail?: string
  responseTime?: number
  icon: React.ComponentType<{ className?: string }>
}

export default function ModelsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchHealth = async () => {
    try {
      const data = await api.health.models()
      setHealth(data)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch health:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 10000)
    return () => clearInterval(interval)
  }, [])

  const handlePullModel = async (modelId: string) => {
    setPulling(modelId)
    setPullProgress(0)
    
    try {
      const response = await api.admin.pullModel(modelId)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.progress) {
                setPullProgress(data.progress)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
      fetchHealth()
    } catch (error) {
      console.error('Failed to pull model:', error)
    } finally {
      setPulling(null)
      setPullProgress(0)
    }
  }

  const getStatusIcon = (status: ServiceInfo['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-amber-500" />
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-500" />
    }
  }

  const getStatusBg = (status: ServiceInfo['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
      case 'degraded':
        return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
      case 'offline':
        return 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
    }
  }

  const services: ServiceInfo[] = [
    {
      name: 'Ollama LLM',
      status: health?.ollama?.status || 'offline',
      detail: health?.ollama?.primary_model,
      icon: Cpu,
    },
    {
      name: 'Embeddings (TEI)',
      status: health?.embeddings?.status || 'offline',
      detail: health?.embeddings?.model,
      icon: Layers,
    },
    {
      name: 'Reranker (TEI)',
      status: health?.reranker?.status || 'offline',
      detail: health?.reranker?.model,
      icon: Server,
    },
    {
      name: 'PostgreSQL',
      status: health?.postgres?.status || 'offline',
      icon: Database,
    },
    {
      name: 'Redis',
      status: health?.redis?.status || 'offline',
      icon: HardDrive,
    },
  ]

  return (
    <div className="space-y-6">
      <Header title="Model Management" breadcrumb={['Dashboard', 'Admin', 'Models']} />

      <Card className="bg-white dark:bg-gray-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Service Health
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {lastUpdated && (
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHealth}
                disabled={loading}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.name}
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  getStatusBg(service.status)
                )}
              >
                <div className="flex items-center gap-3">
                  <service.icon className="w-6 h-6 text-gray-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {service.name}
                      </h4>
                      {getStatusIcon(service.status)}
                    </div>
                    {service.detail && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {service.detail}
                      </p>
                    )}
                    {health?.ollama && service.name === 'Ollama LLM' && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {health.ollama.primary_loaded && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            Primary ✓
                          </span>
                        )}
                        {health.ollama.fallback_loaded && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                            Fallback ✓
                          </span>
                        )}
                        {health.ollama.router_loaded && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                            Router ✓
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Ollama Model Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {AVAILABLE_MODELS.map((model) => {
              const isLoaded = health?.ollama?.primary_model === model.id ||
                              health?.ollama?.fallback_model === model.id ||
                              health?.ollama?.router_model === model.id
              const isPulling = pulling === model.id

              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {model.name}
                    </h4>
                    <p className="text-sm text-gray-500">{model.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{model.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isLoaded && (
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Loaded
                      </span>
                    )}
                    <Button
                      variant={isLoaded ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handlePullModel(model.id)}
                      disabled={isPulling || isLoaded}
                    >
                      {isPulling ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Pulling...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          {isLoaded ? 'Installed' : 'Pull Model'}
                        </>
                      )}
                    </Button>
                  </div>
                  {isPulling && (
                    <Progress value={pullProgress} className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
