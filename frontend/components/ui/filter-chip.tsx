'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface FilterChipProps {
  label: string
  onRemove: () => void
  className?: string
}

export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <Card
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full',
        'bg-primary/10 text-primary text-sm font-medium',
        'cursor-default hover:bg-primary/20 transition-colors',
        className
      )}
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-primary/30 rounded-full p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </Card>
  )
}
