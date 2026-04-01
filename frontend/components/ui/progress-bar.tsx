'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export type Stage = 'routing' | 'retrieving' | 'analyzing' | 'synthesizing'

interface UnifiedProgressBarProps {
  stages: Stage[]
  currentStage: Stage | null
  completedStages: Stage[]
  failedStages: Stage[]
  className?: string
}

const STAGE_LABELS: Record<Stage, string> = {
  routing: 'Routing',
  retrieving: 'Retrieving',
  analyzing: 'Analyzing',
  synthesizing: 'Synthesizing',
}

const STAGE_ORDER: Stage[] = ['routing', 'retrieving', 'analyzing', 'synthesizing']

export function UnifiedProgressBar({
  stages = STAGE_ORDER,
  currentStage,
  completedStages = [],
  failedStages = [],
  className,
}: UnifiedProgressBarProps) {
  const completedCount = completedStages.length
  const totalCount = stages.length
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        {stages.map((stage) => {
          const isCompleted = completedStages.includes(stage)
          const isFailed = failedStages.includes(stage)
          const isActive = currentStage === stage

          return (
            <div key={stage} className="flex items-center gap-1.5">
              {isCompleted ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <div
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border',
                    isActive ? 'border-primary bg-primary animate-pulse' :
                    isFailed ? 'border-red-500 bg-red-100' :
                    'border-gray-300 bg-white'
                  )}
                />
              )}
              <span className={cn(
                isActive ? 'text-primary font-medium' :
                isCompleted ? 'text-green-600' :
                'text-gray-400'
              )}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
          )
        })}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all duration-500',
            failedStages.length > 0 ? 'bg-red-500' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
