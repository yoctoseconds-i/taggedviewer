import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UpdateNotification } from './UpdateNotification'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'settings.updateBanner.title') return 'New Version Available'
      if (key === 'settings.updateBanner.viewRelease') return 'View on GitHub'
      if (key === 'settings.updateBanner.showNotes') return 'View Release Notes'
      if (key === 'settings.updateBanner.hideNotes') return 'Hide Release Notes'
      if (key === 'settings.updateBanner.dismiss') return 'Dismiss'
      if (options?.version) return `Version ${options.version}`
      return key
    },
  }),
}))

describe('UpdateNotification', () => {
  it('renders nothing when update is not available', () => {
    const { container } = render(
      <UpdateNotification
        updateStatus={{ available: false, checking: false }}
        onDismiss={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when update is dismissed', () => {
    const { container } = render(
      <UpdateNotification
        updateStatus={{ available: true, version: '1.0.0', checking: false, dismissed: true }}
        onDismiss={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders update notification banner when update is available', () => {
    render(
      <UpdateNotification
        updateStatus={{
          available: true,
          version: '1.0.0',
          releaseName: 'v1.0.0 Major Update',
          releaseNotes: 'Fixed bugs and improved performance',
          checking: false,
        }}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByText('New Version Available')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0 Major Update')).toBeInTheDocument()
    expect(screen.getByText('View on GitHub')).toBeInTheDocument()
  })

  it('toggles release notes when release notes button is clicked', () => {
    render(
      <UpdateNotification
        updateStatus={{
          available: true,
          version: '1.0.0',
          releaseNotes: 'Cool release notes',
          checking: false,
        }}
        onDismiss={vi.fn()}
      />
    )

    const notesBtn = screen.getByText('View Release Notes')
    expect(screen.queryByText('Cool release notes')).not.toBeInTheDocument()

    fireEvent.click(notesBtn)
    expect(screen.getByText('Cool release notes')).toBeInTheDocument()
    expect(screen.getByText('Hide Release Notes')).toBeInTheDocument()
  })

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <UpdateNotification
        updateStatus={{ available: true, version: '1.0.0', checking: false }}
        onDismiss={onDismiss}
      />
    )

    const dismissBtn = screen.getByTitle('Dismiss')
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
