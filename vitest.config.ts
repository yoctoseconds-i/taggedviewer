import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { join } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    include: ['src/renderer/src/**/*.{test,spec}.{ts,tsx}', 'src/main/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '@renderer': join(__dirname, 'src/renderer/src'),
      '@main': join(__dirname, 'src/main'),
    },
  },
})
