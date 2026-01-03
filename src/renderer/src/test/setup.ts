import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Electron globally
global.window.electron = {
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}
