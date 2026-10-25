import { render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Electron IPC
const mockInvoke = vi.fn()
const mockOn = vi.fn()
const mockRemoveAllListeners = vi.fn()

Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: mockInvoke,
      on: mockOn,
      removeAllListeners: mockRemoveAllListeners,
    },
  },
  writable: true,
})

// Mock useIpc hook
vi.mock('./hooks/useIpc', () => ({
  useIpc: (_loadData: () => void) => {
    // Call loadData immediately to simulate initial load if needed
    // or expose it
    return {
      isScanning: false,
      setIsScanning: vi.fn(),
      scanProgress: { current: 0, total: 0 },
      openFolder: vi.fn(),
      toggleFavorite: vi.fn(),
      showItemInFolder: vi.fn(),
      clearLibrary: vi.fn(),
      rescanLibrary: vi.fn(),
      version: '1.0.0',
      updateStatus: { available: false, checking: false },
      dismissUpdate: vi.fn(),
      checkForUpdates: vi.fn(),
      openLibrary: vi.fn(),
      getCurrentLibrary: vi.fn().mockResolvedValue(null),
    }
  },
}))

// Mock react-i18next
const mockChangeLanguage = vi.fn()
const mockI18n = {
  changeLanguage: mockChangeLanguage,
  language: 'en',
}
const mockT = (key: string) => key

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: mockI18n,
  }),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockInvoke.mockImplementation((channel) => {
      switch (channel) {
        case 'settings:get':
          return Promise.resolve({ threadCount: 2 })
        case 'scan:resume':
          return Promise.resolve()
        case 'db:getImageCount':
          return Promise.resolve(0)
        case 'db:getImages':
          return Promise.resolve([])
        case 'db:getTags':
          return Promise.resolve([])
        case 'db:getTagGroups':
          return Promise.resolve([])
        default:
          return Promise.resolve(null)
      }
    })
  })

  it('renders without crashing and shows empty library state', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('app.emptyLibrary')).toBeInTheDocument()
    })
  })

  it('does not block UI initialization even if scan:resume is pending', async () => {
    // scan:resume never resolves immediately (simulating long background queue processing)
    let resolveScanResume: () => void = () => {}
    mockInvoke.mockImplementation((channel) => {
      switch (channel) {
        case 'settings:get':
          return Promise.resolve({ threadCount: 2 })
        case 'scan:resume':
          return new Promise<void>((resolve) => {
            resolveScanResume = resolve
          })
        case 'db:getImageCount':
          return Promise.resolve(0)
        case 'db:getImages':
          return Promise.resolve([])
        case 'db:getTags':
          return Promise.resolve([])
        case 'db:getTagGroups':
          return Promise.resolve([])
        default:
          return Promise.resolve(null)
      }
    })

    render(<App />)

    // UI should still finish initial loading and show emptyLibrary without waiting for scan:resume
    await waitFor(() => {
      expect(screen.getByText('app.emptyLibrary')).toBeInTheDocument()
      expect(mockInvoke).toHaveBeenCalledWith('db:getTagGroups')
    })

    // Clean up pending promise
    resolveScanResume()
  })
})
