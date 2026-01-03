import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  const defaultProps = {
    tags: [
      { id: 1, name: 'tag1', count: 10, is_favorite: 1 },
      { id: 2, name: 'tag2', count: 5, is_favorite: 0 },
    ],
    activeTag: null,
    onTagClick: vi.fn(),
    tagSort: 'name' as const,
    onToggleSort: vi.fn(),
    onOpenSettings: vi.fn(),
    tagSearchTerm: '',
    onSearchChange: vi.fn(),
    onToggleFavorite: vi.fn(), // This is expected but currently missing in types/impl
  }

  it('renders favorite tags in a separate section', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
  })

  it('renders a star button to toggle favorites', () => {
    render(<Sidebar {...defaultProps} />)
    // Find all star buttons. There should be one for each tag.
    const starButtons = screen
      .getAllByRole('button')
      .filter(
        (btn) =>
          btn.querySelector('svg.lucide-star') ||
          btn.getAttribute('aria-label')?.includes('favorite')
      )
    expect(starButtons.length).toBeGreaterThan(0)
  })

  it('calls onToggleFavorite when star is clicked', () => {
    render(<Sidebar {...defaultProps} />)
    const starButtons = screen.getAllByRole('button', { name: /favorite/i })
    fireEvent.click(starButtons[0])
    expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith(defaultProps.tags[0].id)
  })
})
