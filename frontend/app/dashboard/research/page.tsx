'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { FilterChip } from '@/components/ui/filter-chip'
import { DomainPreset } from '@/components/ui/domain-preset'
import { FilterPanelPopover } from '@/components/search/FilterPanelPopover'
import { AgentThinkingPanel } from '@/components/chat/AgentThinkingPanel'
import { Drawer } from '@/components/ui/drawer'
import { UnifiedProgressBar } from '@/components/ui/progress-bar'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ActiveFilter {
  label: string
  onRemove: () => void
}

function ResearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('query') || ''

  const [filters, setFilters] = useState<Record<string, unknown>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [completedStages, setCompletedStages] = useState<string[]>([])

  // Parse filters from initial query
  const docTypes: string[] = []
  if (initialQuery.toLowerCase().includes('constitutional') || initialQuery.toLowerCase().includes('constitution')) {
    docTypes.push('constitution')
  }
  if (initialQuery.toLowerCase().includes('si ') || initialQuery.toLowerCase().includes('statutory instrument')) {
    docTypes.push('statutory_instrument')
  }
  if (initialQuery.toLowerCase().includes('case') || initialQuery.toLowerCase().includes('precedent')) {
    docTypes.push('case_law')
  }
  if (initialQuery.toLowerCase().includes('act') && !docTypes.includes('constitution')) {
    docTypes.push('act')
  }

  const activeFilters: ActiveFilter[] = []
  if (docTypes.length > 0) {
    activeFilters.push({
      label: docTypes.join(', '),
      onRemove: () => setFilters((f) => ({ ...f, doc_type: undefined })),
    })
  }

  const domain = docTypes.includes('constitution')
    ? 'constitutional'
    : docTypes.includes('statutory_instrument')
    ? 'immigration'
    : 'all'

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <Header title="Research" breadcrumb={['Dashboard', 'Research']} />

      {/* Filter chips + domain bar */}
      <div className="mt-6 px-6 space-y-3">
        <div className="flex items-center gap-3">
          <DomainPreset
            value={domain}
            onChange={(val) => {
              const docTypeMap: Record<string, string | string[] | undefined> = {
                constitutional: 'constitution',
                employment: 'act',
                immigration: 'statutory_instrument',
                commercial: 'act',
                all: undefined,
              }
              const mapped = docTypeMap[val]
              setFilters((f) => ({
                ...f,
                doc_type: mapped ? [mapped] : undefined,
              }))
            }}
          />
        </div>

        {/* Active filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((chip, idx) => (
            <FilterChip key={idx} label={chip.label} onRemove={chip.onRemove} />
          ))}
          <FilterPanelPopover filters={filters} onFiltersChange={setFilters} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 mt-4">
        <UnifiedProgressBar
          stages={['routing', 'retrieving', 'analyzing', 'synthesizing']}
          currentStage={currentStage}
          completedStages={completedStages}
          failedStages={[]}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 mt-4 px-6 pb-6 overflow-y-auto">
        <ChatInterface
          initialQuery={initialQuery}
          filters={filters}
        />
      </div>

      {/* Floating agent icon — uses AgentThinkingPanel in icon mode */}
      <AgentThinkingPanel variant="icon" onIconClick={() => setDrawerOpen(true)} className="fixed bottom-6 right-6" />

      {/* Agent drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="pt-12">
          <AgentThinkingPanel variant="panel" />
        </div>
      </Drawer>
    </div>
  )
}

export default function ResearchPage() {
  return <ResearchContent />
}
