'use client'

import { cn } from '@/lib/utils'
import { Lock, Cpu } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  modelUsed?: string
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  isStreaming?: boolean
  className?: string
}

const confidenceColors = {
  HIGH: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function MessageBubble({
  role,
  content,
  modelUsed,
  confidence,
  isStreaming,
  className,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'flex',
        role === 'user' ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          role === 'user'
            ? 'bg-primary text-white'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'
        )}
      >
        {role === 'assistant' && modelUsed && (
          <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400">
            <Cpu className="w-3 h-3" />
            <span>{modelUsed} — Local</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="w-3 h-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Processed Locally</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {role === 'assistant' && isStreaming && (
          <span className="streaming-cursor" aria-hidden="true" />
        )}

        {role === 'assistant' && confidence && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                confidenceColors[confidence]
              )}
            >
              {confidence} Confidence
            </span>
          </div>
        )}

        {role === 'assistant' && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              <span>🔒 Processed Locally</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
