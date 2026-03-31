import { render, screen } from '@testing-library/react'
import { UnifiedProgressBar } from '@/components/ui/progress-bar'

describe('UnifiedProgressBar', () => {
  it('renders all four stages', () => {
    render(<UnifiedProgressBar stages={['routing', 'retrieving', 'analyzing', 'synthesizing']} currentStage={null} completedStages={[]} failedStages={[]} />)
    expect(screen.getByText('Routing')).toBeInTheDocument()
    expect(screen.getByText('Retrieving')).toBeInTheDocument()
    expect(screen.getByText('Analyzing')).toBeInTheDocument()
    expect(screen.getByText('Synthesizing')).toBeInTheDocument()
  })

  it('shows correct percentage for completed stages', () => {
    const { container } = render(
      <UnifiedProgressBar stages={['routing', 'retrieving', 'analyzing', 'synthesizing']} currentStage={null} completedStages={['routing', 'retrieving']} failedStages={[]} />
    )
    // 2 of 4 = 50%
    const bar = container.querySelector('.bg-primary')
    expect(bar?.getAttribute('style')).toContain('width: 50%')
  })
})
