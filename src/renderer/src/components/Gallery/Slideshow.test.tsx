import { render, screen, fireEvent } from '@testing-library/react'
import { Slideshow } from './Slideshow'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Image } from '../../types'

const mockImages: Image[] = [
  { id: 1, filepath: 'C:\\test\\image1.png', scanned_at: new Date().toISOString() },
  { id: 2, filepath: 'C:\\test\\image2.png', scanned_at: new Date().toISOString() },
]

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('Slideshow', () => {
  const onClose = vi.fn()
  const onImageClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.window.electron = {
      ipcRenderer: {
        invoke: vi
          .fn()
          .mockResolvedValue({ width: 800, height: 600, format: 'png', size: 1024 * 1024 }),
      },
    } as any
  })

  it('renders correctly and displays the initial image', () => {
    render(
      <Slideshow images={mockImages} startIndex={0} onClose={onClose} onImageClick={onImageClick} />
    )

    const img = document.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img?.getAttribute('src')).toContain('C:/test/image1.png')
  })

  it('handles onClose when close button is clicked', () => {
    render(
      <Slideshow images={mockImages} startIndex={0} onClose={onClose} onImageClick={onImageClick} />
    )

    const closeBtn = screen.getByTitle('slideshow.close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('handles image clicking to open detail view', () => {
    render(
      <Slideshow images={mockImages} startIndex={0} onClose={onClose} onImageClick={onImageClick} />
    )

    const img = document.querySelector('img')
    if (img && img.parentElement) {
      fireEvent.click(img.parentElement)
    }
    expect(onImageClick).toHaveBeenCalledWith(0)
  })
})
