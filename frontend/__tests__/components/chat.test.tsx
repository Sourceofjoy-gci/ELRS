import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { SourceCitation } from '@/components/chat/SourceCitation'
import { AgentThinkingPanel } from '@/components/chat/AgentThinkingPanel'

describe('MessageBubble', () => {
  it('renders user message with right alignment', () => {
    render(<MessageBubble role="user" content="Hello" />)
    
    expect(screen.getByText('Hello')).toBeInTheDocument()
    const bubble = screen.getByText('Hello').closest('div')
    expect(bubble).toHaveClass('justify-end')
  })

  it('renders assistant message with left alignment', () => {
    render(<MessageBubble role="assistant" content="Hello from AI" />)
    
    const bubble = screen.getByText('Hello from AI').closest('div')
    expect(bubble).toHaveClass('justify-start')
  })

  it('shows privacy badge for assistant messages', () => {
    render(<MessageBubble role="assistant" content="Response" />)
    
    expect(screen.getByText('🔒 Processed Locally')).toBeInTheDocument()
  })

  it('displays confidence badge when provided', () => {
    render(
      <MessageBubble 
        role="assistant" 
        content="Response" 
        confidence="HIGH"
      />
    )
    
    expect(screen.getByText('HIGH Confidence')).toBeInTheDocument()
  })

  it('shows model badge when modelUsed is provided', () => {
    render(
      <MessageBubble 
        role="assistant" 
        content="Response" 
        modelUsed="mistral:7b"
      />
    )
    
    expect(screen.getByText(/mistral:7b/)).toBeInTheDocument()
  })
})

describe('SourceCitation', () => {
  const mockCitation = {
    act_name: 'Employment Act',
    section_number: '35',
    chunk_excerpt: 'An employer may terminate a contract by giving notice...',
    reranker_score: 0.85,
  }

  it('renders citation act name', () => {
    render(<SourceCitation citation={mockCitation} />)
    
    expect(screen.getByText('Employment Act')).toBeInTheDocument()
  })

  it('renders section number', () => {
    render(<SourceCitation citation={mockCitation} />)
    
    expect(screen.getByText('s 35')).toBeInTheDocument()
  })

  it('shows reranker score', () => {
    render(<SourceCitation citation={mockCitation} />)
    
    expect(screen.getByText(/Score: 0\.85/)).toBeInTheDocument()
  })

  it('has copy citation button', () => {
    render(<SourceCitation citation={mockCitation} />)
    
    expect(screen.getByText('Copy Citation')).toBeInTheDocument()
  })

  it('truncates long excerpts', () => {
    const longExcerpt = 'A'.repeat(300)
    render(<SourceCitation citation={{ ...mockCitation, chunk_excerpt: longExcerpt }} />)
    
    const excerpt = screen.getByText(/^A+...$/)
    expect(excerpt).toBeInTheDocument()
  })
})

describe('AgentThinkingPanel', () => {
  it('shows placeholder when no trace', () => {
    render(<AgentThinkingPanel />)
    
    expect(screen.getByText('Submit a query to see agent activity')).toBeInTheDocument()
  })

  it('renders completed agent with check icon', () => {
    const trace = [
      {
        agent: 'router',
        action: 'Routing query',
        status: 'completed' as const,
        latency_ms: 150,
      },
    ]
    
    render(<AgentThinkingPanel trace={trace} />)
    
    expect(screen.getByText('Router Agent')).toBeInTheDocument()
    expect(screen.getByText('Routing query')).toBeInTheDocument()
  })

  it('renders active agent with loading icon', () => {
    const trace = [
      {
        agent: 'synthesis',
        action: 'Generating response',
        status: 'active' as const,
      },
    ]
    
    render(<AgentThinkingPanel trace={trace} />)
    
    expect(screen.getByText('Synthesis Agent')).toBeInTheDocument()
    expect(screen.getByText('Generating response')).toBeInTheDocument()
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('shows chunk count for completed agents', () => {
    const trace = [
      {
        agent: 'statute',
        action: 'Searching',
        status: 'completed' as const,
        chunks_found: 7,
        top_score: 0.91,
      },
    ]
    
    render(<AgentThinkingPanel trace={trace} />)
    
    expect(screen.getByText('7 chunks found')).toBeInTheDocument()
  })
})
