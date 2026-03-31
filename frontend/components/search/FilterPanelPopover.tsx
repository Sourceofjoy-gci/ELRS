'use client'

import { FilterPanel } from './FilterPanel'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface FilterPanelPopoverProps {
  filters: Record<string, unknown>
  onFiltersChange: (filters: Record<string, unknown>) => void
}

export function FilterPanelPopover({ filters, onFiltersChange }: FilterPanelPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
      </PopoverContent>
    </Popover>
  )
}
