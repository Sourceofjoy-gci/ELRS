import { render, screen } from '@testing-library/react'
import { AgentCard } from '@/components/ui/agent-card'

describe('AgentCard', () => {
  it('renders agent display name', () => {
    render(<AgentCard agentName="statute" displayName="Statute Agent" status="completed" latencyMs={2300} />)
    expect(screen.getByText('Statute Agent')).toBeInTheDocument()
  })

  it('renders latency', () => {
    render(<AgentCard agentName="statute" displayName="Statute Agent" status="completed" latencyMs={2300} />)
    expect(screen.getByText('2.3s')).toBeInTheDocument()
  })

  it('is collapsed by default for completed', () => {
    render(<AgentCard agentName="statute" displayName="Statute Agent" status="completed" latencyMs={2300} subSteps={[{ label: 'Retrieving', status: 'completed' }]} />)
    expect(screen.queryByText('Retrieving')).not.toBeInTheDocument()
  })

  it('is expanded by default for active', () => {
    render(<AgentCard agentName="statute" displayName="Statute Agent" status="active" subSteps={[{ label: 'Retrieving', status: 'running' }]} />)
    expect(screen.getByText('Retrieving')).toBeInTheDocument()
  })
})
