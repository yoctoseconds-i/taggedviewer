import { Tag, TagGroup } from '../../types'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div>
      {data.map((item: any, index: number) => (
        <div key={index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('Sidebar', () => {
  const defaultProps = {
    tags: [
      { id: 1, name: 'tag1', count: 10, is_favorite: true },
      { id: 2, name: 'tag2', count: 5, is_favorite: false },
    ],
    activeTags: [],
    onTagClick: vi.fn(),
    tagSort: 'name' as const,
    onToggleSort: vi.fn(),
    onOpenSettings: vi.fn(),
    tagSearchTerm: '',
    onSearchChange: vi.fn(),
    onToggleFavorite: vi.fn(),
    onUpdateLanguage: vi.fn(),
    onSync: vi.fn(),
    onSelectLibrary: vi.fn(),
    onClearDatabase: vi.fn(),
    tagGroups: [],
    onGroupClick: vi.fn(),
    onCreateGroup: vi.fn(),
    onEditGroup: vi.fn(),
  }

  it('renders favorite tags in a separate section', () => {
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('sidebar.favorites')).toBeInTheDocument()
    expect(screen.getByText('sidebar.tags')).toBeInTheDocument()
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
