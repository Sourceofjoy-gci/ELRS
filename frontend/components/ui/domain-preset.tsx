'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const DOMAIN_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'constitutional', label: 'Constitutional Law' },
  { value: 'employment', label: 'Employment & Labour' },
  { value: 'immigration', label: 'Immigration & Stateless Persons' },
  { value: 'commercial', label: 'Commercial & Corporate' },
]

interface DomainPresetProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function DomainPreset({ value, onChange, className }: DomainPresetProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Label className="text-sm font-medium text-gray-500 whitespace-nowrap">Domain:</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          {DOMAIN_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
