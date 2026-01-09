import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron's app.getPath before importing db
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return process.cwd()
      return ''
    },
  },
}))

// Mock fs to ensure we don't use real DB if possible,
// strictly speaking better-sqlite3 writes to disk, so we use a test file

// We need to ensure the module uses our test path or we clean it up
// Since db.ts is a singleton that initializes on import, we might need to rely on the mocked app.getPath

import { getAllImages, insertImagesBulk, clearDatabase } from '../src/main/db'

describe('Database Tests', () => {
  beforeEach(async () => {
    await clearDatabase.run()
  })

  it('should handle pagination with 0 items', async () => {
    const images = await getAllImages.all(100, 0)
    expect(images).toEqual([])
  })

  it('should fetch images with limit and offset', async () => {
    const testFiles = ['img1.png', 'img2.png', 'img3.png']
    await insertImagesBulk.run(testFiles)

    const page1 = await getAllImages.all(2, 0)
    expect(page1.length).toBe(2)
    // Ordered by scanned_at DESC (newest first).
    // insertImagesBulk inserts sequentially, so timestamp might be same or close.
    // The query is ORDER BY scanned_at DESC.

    const page2 = await getAllImages.all(2, 2)
    expect(page2.length).toBe(1)
  })

  it('should handle default parameters', async () => {
    await insertImagesBulk.run(['test.png'])
    const images = await getAllImages.all()
    expect(images.length).toBe(1)
  })
})
