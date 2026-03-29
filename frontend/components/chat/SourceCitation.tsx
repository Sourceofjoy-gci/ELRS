'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatCitation } from '@/lib/utils'
import { Copy, ExternalLink, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface Citation {
  act_name: string
  year?: number
  section_number?: string
  chunk_excerpt: string
  reranker_score: number
  document_id?: string
}

interface SourceCitationProps {
  citation: Citation
  className?: string
}

export function SourceCitation({ citation, className }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const formattedCitation = formatCitation(
    citation.act_name,
    citation.year || null,
    citation.section_number || null
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedCitation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const scoreColor =
    citation.reranker_score >= 0.8
      ? 'text-green-600'
      : citation.reranker_score >= 0.6
      ? 'text-amber-600'
      : 'text-gray-500'

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className={className}>
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                    {citation.act_name}
                  </h4>
                  {citation.section_number && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                      s {citation.section_number}
                    </span>
                  )}
                  <span className={cn('text-xs font-medium', scoreColor)}>
                    Score: {citation.reranker_score.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {citation.chunk_excerpt.length > 200
                    ? citation.chunk_excerpt.slice(0, 200) + '...'
                    : citation.chunk_excerpt}
                </p>
              </div>
            </div>
          </div>

          <CollapsibleContent className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {citation.chunk_excerpt}
            </p>
          </CollapsibleContent>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                {copied ? 'Copied!' : 'Copy Citation'}
              </Button>
              {citation.document_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  asChild
                >
                  <a href={`/dashboard/documents/${citation.document_id}`}>
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open Document
                  </a>
                </Button>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardContent>
      </Card>
    </Collapsible>
  )
}
