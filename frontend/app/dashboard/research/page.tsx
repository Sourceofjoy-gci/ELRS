'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { FilterPanel } from '@/components/search/FilterPanel'
import { AgentThinkingPanel } from '@/components/chat/AgentThinkingPanel'
import { cn } from '@/lib/utils'
import { MessageSquare, X, Filter } from 'lucide-react'

function ResearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('query') || ''

  const [panelOpen, setPanelOpen] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<Record<string, unknown>>({})

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <Header
        title="Research"
        breadcrumb={['Dashboard', 'Research']}
      />

      <div className="flex flex-1 gap-6 mt-6 overflow-hidden">
        <FilterPanel
          className={cn(
            'w-72 flex-shrink-0 transition-all duration-300',
            filterOpen ? 'block' : 'hidden lg:block'
          )}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="flex-1 min-w-0">
          <ChatInterface
            initialQuery={initialQuery}
            filters={filters}
          />
        </div>

        <AgentThinkingPanel
          className={cn(
            'w-80 flex-shrink-0 transition-all duration-300',
            panelOpen ? 'block' : 'hidden xl:block'
          )}
        />
      </div>

      <button
        onClick={() => setFilterOpen(!filterOpen)}
        className="fixed bottom-6 left-6 lg:hidden p-3 bg-primary text-white rounded-full shadow-lg"
      >
        <Filter className="w-5 h-5" />
      </button>

      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="fixed bottom-6 right-6 xl:hidden p-3 bg-primary text-white rounded-full shadow-lg"
      >
        {panelOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <Header
        title="Research"
        breadcrumb={['Dashboard', 'Research']}
      />
      <div className="flex flex-1 gap-6 mt-6 overflow-hidden items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading research interface...</div>
      </div>
    </div>
  )
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResearchContent />
    </Suspense>
  )
}
