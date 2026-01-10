import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsModal } from './SettingsModal'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

describe('SettingsModal', () => {
  const defaultProps = {
    show: true,
    onClose: vi.fn(),
    settings: { threadCount: 2 },
    onUpdateThreadCount: vi.fn(),
    onUpdateLanguage: vi.fn(),
    onSync: vi.fn(),
    onSelectLibrary: vi.fn(),
    onClearDatabase: vi.fn(),
    onRescan: vi.fn(),
    onClear: vi.fn(),
    version: '1.0.0',
    updateStatus: { available: false, checking: false },
    onCheckForUpdates: vi.fn(),
  }

  it('renders correctly when shown', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByText('settings.title')).toBeInTheDocument()
    expect(screen.getByText('settings.threadCount')).toBeInTheDocument()
    expect(screen.getByText(/2 threads/i)).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    render(<SettingsModal {...defaultProps} />)
    const closeButtons = screen.getAllByText('common.cancel')
    fireEvent.click(closeButtons[0])
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('calls onUpdateThreadCount when slider changes', () => {
    render(<SettingsModal {...defaultProps} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '4' } })
    expect(defaultProps.onUpdateThreadCount).toHaveBeenCalledWith(4)
  })

  it('calls onRescan and onClear when buttons are clicked', () => {
    render(<SettingsModal {...defaultProps} />)
    fireEvent.click(screen.getByText('settings.rescan'))
    expect(defaultProps.onRescan).toHaveBeenCalled()

    fireEvent.click(screen.getByText('settings.clear'))
    expect(defaultProps.onClear).toHaveBeenCalled()
  })

  it('does not render when show is false', () => {
    const { container } = render(<SettingsModal {...defaultProps} show={false} />)
    expect(container.firstChild).toBeNull()
  })
})
