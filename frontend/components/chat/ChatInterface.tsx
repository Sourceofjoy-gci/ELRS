'use client'

import { useState, useRef, useEffect } from 'react'
import { useStreamingChat } from '@/lib/hooks/useStreamingChat'
import { MessageBubble } from './MessageBubble'
import { SourceCitation } from './SourceCitation'
import { CitationPanel, Citation } from '@/components/ui/citation-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { Send, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{
    id: string
    act_name: string
    section_number?: string
    year?: number
    chunk_excerpt: string
    reranker_score: number
  }>
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  model_used?: string
  disclaimer?: string
}

interface ChatInterfaceProps {
  initialQuery?: string
  filters?: Record<string, unknown>
  className?: string
}

export function ChatInterface({ initialQuery, filters, className }: ChatInterfaceProps) {
  const [query, setQuery] = useState(initialQuery || '')
  const [messages, setMessages] = useState<Message[]>([])
  const [citationPanelOpen, setCitationPanelOpen] = useState(false)
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null)
  const [highlightEnabled, setHighlightEnabled] = useState(false)
  const [streamEnded, setStreamEnded] = useState(false)
  const [showConfidence, setShowConfidence] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    tokens,
    agentTrace,
    sources,
    isStreaming,
    error,
    submitQuery,
  } = useStreamingChat()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tokens, messages])

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      handleSubmit(initialQuery)
    }
  }, [initialQuery])

  const handleSubmit = async (q?: string) => {
    const submittedQuery = q || query
    if (!submittedQuery.trim() || isStreaming) return

    setShowConfidence(false)
    setStreamEnded(false)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: submittedQuery,
    }

    setMessages((prev) => [...prev, userMessage])
    setQuery('')

    await submitQuery(submittedQuery, filters)
  }

  useEffect(() => {
    if (tokens && isStreaming) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'user') {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: tokens,
          sources,
          confidence: undefined,
        }
        setMessages((prev) => [...prev.slice(0, -1), assistantMessage])
      } else {
        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === prev.length - 1
              ? { ...msg, content: tokens, sources }
              : msg
          )
        )
      }
    }
  }, [tokens, isStreaming, sources])

  useEffect(() => {
    if (!isStreaming && tokens && messages.length > 0) {
      setStreamEnded(true)
      // 300ms delay before showing confidence
      setTimeout(() => {
        setShowConfidence(true)
      }, 300)
    }
  }, [isStreaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  function renderAnswerWithCitations(content: string, sources: Message['sources']) {
    if (!sources || sources.length === 0) return <p>{content}</p>

    // Split content on citation markers like [1], [2], etc.
    const parts = content.split(/(\[\d+\])/g)

    return (
      <p>
        {parts.map((part, idx) => {
          const match = part.match(/^\[(\d+)\]$/)
          if (match) {
            const citationIdx = parseInt(match[1], 10) - 1
            const citation = sources[citationIdx]
            if (citation) {
              return (
                <sup
                  key={idx}
                  className="text-primary cursor-pointer hover:bg-primary/10 px-0.5 rounded mx-0.5"
                  onClick={() => {
                    setActiveCitationId(citation.id)
                    setCitationPanelOpen(true)
                  }}
                  title={`View ${citation.act_name} citation`}
                >
                  [{match[1]}]
                </sup>
              )
            }
          }
          return <span key={idx}>{part}</span>
        })}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-thin">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Start Your Legal Research
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Ask questions about Eswatini legislation, constitutional rights,
              or compare different acts of parliament.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            {message.role === 'assistant' && message.sources && message.sources.length > 0
              ? renderAnswerWithCitations(message.content, message.sources)
              : <MessageBubble
                  role={message.role}
                  content={message.content}
                  modelUsed={message.model_used}
                  confidence={showConfidence ? message.confidence : undefined}
                  isStreaming={isStreaming && message.role === 'assistant'}
                />}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="sources">
                    <AccordionTrigger className="text-sm font-medium">
                      View {message.sources.length} Source{message.sources.length > 1 ? 's' : ''}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {message.sources.map((source, idx) => (
                          <SourceCitation
                            key={source.id || idx}
                            citation={{
                              act_name: source.act_name,
                              section_number: source.section_number,
                              chunk_excerpt: source.chunk_excerpt,
                              reranker_score: source.reranker_score,
                            }}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        ))}

        {error && (
          <Card className="p-4 bg-destructive/10 border-destructive">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Eswatini law..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            onClick={() => handleSubmit()}
            disabled={!query.trim() || isStreaming}
            size="icon"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-right">
          Press ⌘/Ctrl + Enter to submit
        </p>
      </div>
      <CitationPanel
        citations={(sources || []) as Citation[]}
        activeCitationId={activeCitationId}
        onClose={() => setCitationPanelOpen(false)}
        onHighlightToggle={setHighlightEnabled}
        highlightEnabled={highlightEnabled}
      />
    </div>
  )
}
