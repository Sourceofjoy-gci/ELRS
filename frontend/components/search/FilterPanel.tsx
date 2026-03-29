'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Filter, RotateCcw } from 'lucide-react'

interface FilterPanelProps {
  className?: string
  filters: Record<string, unknown>
  onFiltersChange: (filters: Record<string, unknown>) => void
}

const DOC_TYPES = [
  { value: 'act', label: 'Act' },
  { value: 'constitution', label: 'Constitutional' },
  { value: 'statutory_instrument', label: 'Statutory Instrument' },
  { value: 'case_law', label: 'Case Law' },
  { value: 'regulation', label: 'Regulation' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'amended', label: 'Amended' },
  { value: 'repealed', label: 'Repealed' },
  { value: 'draft', label: 'Draft' },
]

export function FilterPanel({ className, filters, onFiltersChange }: FilterPanelProps) {
  const [docTypes, setDocTypes] = useState<string[]>(
    (filters.doc_type as string[]) || []
  )
  const [yearRange, setYearRange] = useState<[number, number]>([1960, 2025])
  const [ministry, setMinistry] = useState<string>((filters.ministry as string) || 'all')
  const [status, setStatus] = useState<string>((filters.status as string) || 'all')
  const [ministries, setMinistries] = useState<string[]>([])

  useEffect(() => {
    const fetchMinistries = async () => {
      try {
        const data = await api.documents.list()
        const uniqueMinistries = [...new Set(
          data.documents
            .map((d) => d.ministry)
            .filter(Boolean)
        )] as string[]
        setMinistries(uniqueMinistries)
      } catch {
        setMinistries([])
      }
    }
    fetchMinistries()
  }, [])

  useEffect(() => {
    onFiltersChange({
      doc_type: docTypes.length > 0 ? docTypes : undefined,
      year_min: yearRange[0] !== 1960 ? yearRange[0] : undefined,
      year_max: yearRange[1] !== 2025 ? yearRange[1] : undefined,
      ministry: ministry !== 'all' ? ministry : undefined,
      status: status !== 'all' ? status : undefined,
    })
  }, [docTypes, yearRange, ministry, status])

  const handleDocTypeToggle = (value: string) => {
    setDocTypes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    )
  }

  const handleClearFilters = () => {
    setDocTypes([])
    setYearRange([1960, 2025])
    setMinistry('all')
    setStatus('all')
  }

  const hasActiveFilters =
    docTypes.length > 0 ||
    yearRange[0] !== 1960 ||
    yearRange[1] !== 2025 ||
    ministry !== 'all' ||
    status !== 'all'

  return (
    <Card className={cn('bg-white dark:bg-gray-900 h-fit', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Document Type</Label>
          <div className="space-y-2">
            {DOC_TYPES.map((type) => (
              <div key={type.value} className="flex items-center gap-2">
                <Checkbox
                  id={`doc-type-${type.value}`}
                  checked={docTypes.includes(type.value)}
                  onCheckedChange={() => handleDocTypeToggle(type.value)}
                />
                <Label
                  htmlFor={`doc-type-${type.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Year Range</Label>
          <Slider
            value={yearRange}
            onValueChange={(value) => setYearRange(value as [number, number])}
            min={1960}
            max={2025}
            step={1}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{yearRange[0]}</span>
            <span>{yearRange[1]}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Ministry</Label>
          <Select value={ministry} onValueChange={setMinistry}>
            <SelectTrigger>
              <SelectValue placeholder="All ministries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ministries</SelectItem>
              {ministries.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
