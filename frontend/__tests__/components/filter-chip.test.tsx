import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChip } from '@/components/ui/filter-chip'

describe('FilterChip', () => {
  it('renders label', () => {
    render(<FilterChip label="Acts" onRemove={jest.fn()} />)
    expect(screen.getByText('Acts')).toBeInTheDocument()
  })

  it('calls onRemove when X is clicked', () => {
    const onRemove = jest.fn()
    render(<FilterChip label="Acts" onRemove={onRemove} />)
    fireEvent.click(screen.getByLabelText('Remove Acts filter'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
