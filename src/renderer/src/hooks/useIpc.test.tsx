import { renderHook } from '@testing-library/react'
import { useIpc } from './useIpc'
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

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

describe('useIpc hook', () => {
  const mockLoadData = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'app:getVersion') return Promise.resolve('1.0.0')
      return Promise.resolve(null)
    })
  })

  it('renders without crashing', () => {
    const { result } = renderHook(() => useIpc(mockLoadData))
    expect(result.current).toBeDefined()
  })

  it('sets up scan progress listeners on mount', () => {
    renderHook(() => useIpc(mockLoadData))

    expect(mockOn).toHaveBeenCalledWith('scan:progress', expect.any(Function))
    expect(mockOn).toHaveBeenCalledWith('scan:start', expect.any(Function))
    expect(mockOn).toHaveBeenCalledWith('scan:complete', expect.any(Function))
  })

  it('removes listeners on unmount', () => {
    const { unmount } = renderHook(() => useIpc(mockLoadData))
    unmount()

    expect(mockRemoveAllListeners).toHaveBeenCalledWith('scan:progress')
    expect(mockRemoveAllListeners).toHaveBeenCalledWith('scan:complete')
  })
})
