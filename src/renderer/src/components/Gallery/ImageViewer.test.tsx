import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageViewer } from './ImageViewer'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Image, Tag } from '../../types'

const mockImage: Image = {
  id: 1,
  filepath: 'C:\\test\\image.png',
  scanned_at: new Date().toISOString(),
}

const mockTags: Tag[] = [{ id: 1, name: 'tag1', count: 1 }]

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ImageViewer', () => {
  const onClose = vi.fn()
  const onOpenFolder = vi.fn()
  const onToggleFavorite = vi.fn()
  const onTagClick = vi.fn()
  const onPrev = vi.fn()
  const onNext = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock electron globally for this test if not in setup
    global.window.electron = {
      ipcRenderer: {
        invoke: vi.fn().mockResolvedValue({ text: { parameters: 'test prompt' } }),
      },
    } as any
  })

  it('renders image and handles closing', () => {
    render(
      <ImageViewer
        image={mockImage}
        tags={mockTags}
        onClose={onClose}
        onOpenFolder={onOpenFolder}
        onToggleFavorite={onToggleFavorite}
        onTagClick={onTagClick}
      />
    )

    const img = screen.getByRole('presentation', { hidden: true }) || document.querySelector('img')
    expect(img).toBeInTheDocument()

    // Find close button
    const closeBtn = screen.getByLabelText('Close viewer')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('toggles detail pane on image area click', () => {
    render(
      <ImageViewer
        image={mockImage}
        tags={mockTags}
        onClose={onClose}
        onOpenFolder={onOpenFolder}
        onToggleFavorite={onToggleFavorite}
        onTagClick={onTagClick}
      />
    )

    // Initially detail pane should be hidden (check for text that is in detail pane)
    // Note: It might be visible if we just toggle it.
    // In our implementation, clicking the main area toggles it.

    // Find info button or main area
    const mainArea = document.querySelector('.flex-1.flex.items-center.justify-center')
    if (mainArea) fireEvent.click(mainArea)

    expect(screen.getByText('viewer.fileInfo')).toBeInTheDocument()
  })

  it('calls onPrev and onNext when arrows are clicked', () => {
    render(
      <ImageViewer
        image={mockImage}
        tags={mockTags}
        onClose={onClose}
        onOpenFolder={onOpenFolder}
        onToggleFavorite={onToggleFavorite}
        onTagClick={onTagClick}
        onPrev={onPrev}
        onNext={onNext}
      />
    )

    const prevBtn = screen.getByLabelText('Previous image')
    const nextBtn = screen.getByLabelText('Next image')

    fireEvent.click(prevBtn)
    expect(onPrev).toHaveBeenCalled()

    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalled()
  })

  it('fetches and displays prompt modal', async () => {
    render(
      <ImageViewer
        image={mockImage}
        tags={mockTags}
        onClose={onClose}
        onOpenFolder={onOpenFolder}
        onToggleFavorite={onToggleFavorite}
        onTagClick={onTagClick}
      />
    )

    // Open detail pane first
    const mainArea = document.querySelector('.flex-1.flex.items-center.justify-center')
    if (mainArea) fireEvent.click(mainArea)

    await waitFor(() => {
      expect(screen.getByText('viewer.showPrompt')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('viewer.showPrompt'))
    expect(screen.getByText('viewer.promptTitle')).toBeInTheDocument()
    expect(screen.getByText(/test prompt/)).toBeInTheDocument()
  })
})
