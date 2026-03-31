'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface Citation {
  id: string
  act_name: string
  section_number?: string
  year?: number
  chunk_excerpt: string
  reranker_score: number
}

interface CitationPanelProps {
  citations: Citation[]
  activeCitationId: string | null
  onClose: () => void
  onHighlightToggle?: (enabled: boolean) => void
  highlightEnabled?: boolean
  className?: string
}

export function CitationPanel({
  citations,
  activeCitationId,
  onClose,
  onHighlightToggle,
  highlightEnabled = false,
  className,
}: CitationPanelProps) {
  const active = citations.find((c) => c.id === activeCitationId)

  return (
    <div className={cn(
      'fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-900 shadow-xl z-50',
      'flex flex-col border-l border-gray-200 dark:border-gray-700',
      'transform transition-transform duration-200',
      activeCitationId ? 'translate-x-0' : 'translate-x-full',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Citation {active ? `#${citations.indexOf(active) + 1}` : ''}
        </h3>
        <div className="flex items-center gap-2">
          {onHighlightToggle && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onHighlightToggle(!highlightEnabled)}
              className={cn(
                'text-xs',
                highlightEnabled && 'bg-accent-gold-light border-accent-gold'
              )}
            >
              Highlight in answer
            </Button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Citation content */}
      {active ? (
        <CardContent className="flex-1 overflow-y-auto pt-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Act</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{active.act_name}</p>
            </div>
            {active.section_number && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Section</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">s {active.section_number}</p>
              </div>
            )}
            {active.year && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Year</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{active.year}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Relevance Score</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{active.reranker_score.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Excerpt</p>
              <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-gray-700 dark:text-gray-300">
                {active.chunk_excerpt}
              </blockquote>
            </div>
          </div>
        </CardContent>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Click a citation number to view details
        </div>
      )}
    </div>
  )
}
