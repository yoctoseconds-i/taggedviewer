import '@testing-library/jest-dom'
import { vi } from 'vitest'

  // Mock Electron globally
  ; (window as any).electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      send: vi.fn(),
      removeAllListeners: vi.fn(),
    },
  }
