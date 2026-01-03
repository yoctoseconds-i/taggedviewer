import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsModal } from './SettingsModal'

describe('SettingsModal', () => {
  const defaultProps = {
    show: true,
    onClose: vi.fn(),
    settings: { threadCount: 2 },
    onUpdateThreadCount: vi.fn(),
    onRescan: vi.fn(),
    onClear: vi.fn(),
  }

  it('renders correctly when shown', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Analysis Threads')).toBeInTheDocument()
    expect(screen.getByText('2 threads')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    render(<SettingsModal {...defaultProps} />)
    const closeButtons = screen.getAllByText('Close')
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
    fireEvent.click(screen.getByText('Rescan Library (Maintenance)'))
    expect(defaultProps.onRescan).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Clear All Library Data'))
    expect(defaultProps.onClear).toHaveBeenCalled()
  })

  it('does not render when show is false', () => {
    const { container } = render(<SettingsModal {...defaultProps} show={false} />)
    expect(container.firstChild).toBeNull()
  })
})
