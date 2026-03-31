'use client'

import { cn, formatTime } from '@/lib/utils'
import { AgentTraceEvent } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Loader2, Circle, Brain, ArrowRight } from 'lucide-react'

interface AgentThinkingPanelProps {
  trace?: AgentTraceEvent[]
  variant?: 'panel' | 'icon'
  onIconClick?: () => void
  className?: string
}

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  router: 'Router Agent',
  statute: 'Statute Agent',
  constitutional: 'Constitutional Agent',
  case_law: 'Case Law Agent',
  comparison: 'Comparison Agent',
  synthesis: 'Synthesis Agent',
}

export function AgentThinkingPanel({ trace = [], variant = 'panel', onIconClick, className }: AgentThinkingPanelProps) {
  // Icon variant - floating button
  if (variant === 'icon') {
    return (
      <div className={cn('fixed bottom-6 right-6 z-40', className)}>
        <button
          onClick={onIconClick}
          className="p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Brain className="w-5 h-5" />
        </button>
      </div>
    )
  }

  // Panel variant - full card content
  const statusIcon = (status: AgentTraceEvent['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'active':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />
      default:
        return <Circle className="w-4 h-4 text-gray-300" />
    }
  }

  const getAgentSteps = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'router':
        return ['Analyzing query', 'Routing to specialists']
      case 'statute':
        return ['Retrieving statutes', 'Analyzing provisions', 'Formatting response']
      case 'constitutional':
        return ['Retrieving constitutional text', 'Analyzing rights', 'Formatting response']
      case 'case_law':
        return ['Retrieving cases', 'Analyzing precedents', 'Formatting response']
      case 'comparison':
        return ['Retrieving documents', 'Comparing provisions', 'Formatting response']
      case 'synthesis':
        return ['Consolidating findings', 'Generating response', 'Adding citations']
      default:
        return ['Processing']
    }
  }

  return (
    <Card className={cn('bg-white dark:bg-gray-900 h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Agent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trace.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Submit a query to see agent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trace.map((event, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-3">
                  {statusIcon(event.status)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {AGENT_DISPLAY_NAMES[event.agent.toLowerCase()] || event.agent}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {event.action}
                    </p>
                  </div>
                  {event.latency_ms && (
                    <span className="text-xs text-gray-400">
                      {formatTime(event.latency_ms)}
                    </span>
                  )}
                </div>

                {event.status === 'completed' && event.chunks_found !== undefined && (
                  <div className="ml-7 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {event.chunks_found} chunks found
                      {event.top_score && ` (top: ${event.top_score.toFixed(2)})`}
                    </span>
                  </div>
                )}

                {event.status === 'completed' && event.model_used && (
                  <div className="ml-7 text-xs text-gray-400">
                    Model: {event.model_used}
                  </div>
                )}

                {idx < trace.length - 1 && (
                  <div className="ml-5 pl-2 border-l-2 border-gray-100 dark:border-gray-800">
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                  </div>
                )}
              </div>
            ))}

            {trace.some((t) => t.status === 'active') && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
