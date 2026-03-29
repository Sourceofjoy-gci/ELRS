import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/research',
}))

describe('Sidebar', () => {
  it('renders navigation links', () => {
    render(<Sidebar />)
    
    expect(screen.getByText('Research')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('shows ELRI branding', () => {
    render(<Sidebar />)
    
    expect(screen.getByText('ELRI')).toBeInTheDocument()
    expect(screen.getByText('Eswatini Legal Research')).toBeInTheDocument()
  })

  it('has correct sidebar styling', () => {
    const { container } = render(<Sidebar />)
    const sidebar = container.firstChild
    
    expect(sidebar).toHaveClass('bg-sidebar')
    expect(sidebar).toHaveClass('text-white')
  })
})

describe('Header', () => {
  const mockOnMenuClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders title', () => {
    render(<Header title="Research" onMenuClick={mockOnMenuClick} />)
    
    expect(screen.getByText('Research')).toBeInTheDocument()
  })

  it('renders breadcrumb when provided', () => {
    render(
      <Header 
        title="Document"
        breadcrumb={['Dashboard', 'Documents', 'Employment Act']}
        onMenuClick={mockOnMenuClick}
      />
    )
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
  })

  it('calls onMenuClick when menu button is clicked', () => {
    render(<Header title="Test" onMenuClick={mockOnMenuClick} />)
    
    const menuButton = screen.getByRole('button')
    fireEvent.click(menuButton)
    
    expect(mockOnMenuClick).toHaveBeenCalled()
  })
})
