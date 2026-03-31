'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, Loader2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatTime } from '@/lib/utils'

interface SubStep {
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface AgentCardProps {
  agentName: string
  displayName: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  latencyMs?: number
  subSteps?: SubStep[]
  chunksFound?: number
  topScore?: number
  modelUsed?: string
  className?: string
}

const STATUS_ICON = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle,
  failed: Circle,
} as const

const STATUS_COLOR = {
  pending: 'text-gray-300',
  active: 'text-primary',
  completed: 'text-green-500',
  failed: 'text-red-500',
} as const

export function AgentCard({
  agentName,
  displayName,
  status,
  latencyMs,
  subSteps = [],
  chunksFound,
  topScore,
  modelUsed,
  className,
}: AgentCardProps) {
  const [expanded, setExpanded] = useState(status === 'active')

  const Icon = STATUS_ICON[status]
  const isRunning = status === 'active'
  const isCompleted = status === 'completed'

  return (
    <div className={cn(
      'border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden',
      'bg-white dark:bg-gray-900',
      className
    )}>
      {/* Header — always visible, clickable to toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <Icon className={cn(
          'w-4 h-4 flex-shrink-0',
          STATUS_COLOR[status],
          isRunning && 'animate-spin'
        )} />
        <span className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-white">
          {displayName}
        </span>
        {latencyMs !== undefined && (
          <span className="text-xs text-gray-400">{formatTime(latencyMs)}</span>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
          {subSteps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-gray-500">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                step.status === 'completed' ? 'bg-green-500' :
                step.status === 'running' ? 'bg-primary animate-pulse' :
                step.status === 'failed' ? 'bg-red-500' :
                'bg-gray-300'
              )} />
              <span>{step.label}</span>
            </div>
          ))}
          {chunksFound !== undefined && (
            <p className="text-xs text-gray-400">
              {chunksFound} chunks found{topScore !== undefined && ` (top: ${topScore.toFixed(2)})`}
            </p>
          )}
          {modelUsed && (
            <p className="text-xs text-gray-400">Model: {modelUsed}</p>
          )}
        </div>
      )}
    </div>
  )
}
