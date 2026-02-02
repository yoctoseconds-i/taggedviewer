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
      { id: 1, name: 'tag1', count: 10, is_favorite: true, is_hidden: false },
      { id: 2, name: 'tag2', count: 5, is_favorite: false, is_hidden: false },
    ],
    activeTags: [],
    onTagClick: vi.fn(),
    onToggleSort: vi.fn(),
    onOpenSettings: vi.fn(),
    showHidden: false,
    onToggleShowHidden: vi.fn(),
    onToggleHidden: vi.fn(),
    tagSearchTerm: '',
    onSearchChange: vi.fn(),
    onToggleFavorite: vi.fn(),
    tagGroups: [],
    onGroupClick: vi.fn(),
    onCreateGroup: vi.fn(),
    onEditGroup: vi.fn(),
    libraryPath: null,
    onOpenLibrary: vi.fn(),
  }

  it('renders favorite tags in a separate section', () => {
    render(<Sidebar {...defaultProps} />)
    const favoriteSectionHeader = screen.getByText('sidebar.favorites')
    expect(favoriteSectionHeader).toBeInTheDocument()
    expect(screen.getByText('sidebar.tags')).toBeInTheDocument()
  })

  it('renders a star button to toggle favorites', () => {
    render(<Sidebar {...defaultProps} />)
    // Find buttons by aria-label
    const starButtons = screen.getAllByRole('button', { name: /favorite/i })
    expect(starButtons.length).toBeGreaterThan(0)
  })

  it('calls onToggleFavorite when star is clicked', () => {
    render(<Sidebar {...defaultProps} />)
    const starButtons = screen.getAllByRole('button', { name: /favorite/i })
    fireEvent.click(starButtons[0])
    expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith(defaultProps.tags[0].id)
  })
})
