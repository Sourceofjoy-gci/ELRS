import { render, screen, fireEvent } from '@testing-library/react'
import { CitationPanel } from '@/components/ui/citation-panel'

const CITATION = {
  id: '1',
  act_name: 'Employment Act',
  section_number: '35(1)',
  year: 1980,
  chunk_excerpt: 'An employer may terminate by giving notice...',
  reranker_score: 0.87,
}

describe('CitationPanel', () => {
  it('renders closed when activeCitationId is null', () => {
    const { container } = render(
      <CitationPanel citations={[CITATION]} activeCitationId={null} onClose={jest.fn()} />
    )
    expect(container.querySelector('.translate-x-full')).toBeInTheDocument()
  })

  it('renders open when activeCitationId is set', () => {
    render(
      <CitationPanel citations={[CITATION]} activeCitationId="1" onClose={jest.fn()} />
    )
    expect(screen.getByText('Employment Act')).toBeInTheDocument()
    expect(screen.getByText('s 35(1)')).toBeInTheDocument()
  })

  it('calls onClose when X is clicked', () => {
    const onClose = jest.fn()
    render(
      <CitationPanel citations={[CITATION]} activeCitationId="1" onClose={onClose} />
    )
    // The close button is a button without text, find it by aria
    const closeButton = screen.getByRole('button', { hidden: true })
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })
})
