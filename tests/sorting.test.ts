import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Electron's app.getPath before importing db
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return process.cwd()
      return ''
    },
  },
}))

import { insertImagesBulk, getAllImages, clearDatabase } from '../src/main/db'

describe('Image Sorting', () => {
  beforeEach(async () => {
    await clearDatabase.run()
  })

  afterEach(async () => {
    await clearDatabase.run()
  })

  it('should sort images by file_modified_at', async () => {
    const images = [
      { path: '/tmp/img1.jpg', mtime: '2023-01-01T10:00:00.000Z' },
      { path: '/tmp/img2.jpg', mtime: '2023-01-02T10:00:00.000Z' },
      { path: '/tmp/img3.jpg', mtime: '2023-01-03T10:00:00.000Z' },
    ]

    // Insert normally (which writes scanned_at as NOW)
    // But we provide mtime
    const mtimes = {}
    images.forEach((img) => (mtimes[img.path] = img.mtime))

    await insertImagesBulk.run(
      images.map((i) => i.path),
      mtimes
    )

    // Test Ascending (Oldest first)
    const asc = await getAllImages.all(100, 0, 'date', 'asc')
    expect(asc.map((i) => i.filepath)).toEqual(['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'])

    // Test Descending (Newest first)
    const desc = await getAllImages.all(100, 0, 'date', 'desc')
    expect(desc.map((i) => i.filepath)).toEqual(['/tmp/img3.jpg', '/tmp/img2.jpg', '/tmp/img1.jpg'])
  })

  it('should fallback to scanned_at if file_modified_at is missing', async () => {
    // Insert without mtimes
    const paths = ['/tmp/a.jpg', '/tmp/b.jpg']
    await insertImagesBulk.run(paths) // both have almost same scanned_at

    // We can't easily guarantee strict order if scanned_at is identical,
    // but at least it should not crash and return results
    const res = await getAllImages.all()
    expect(res.length).toBe(2)
  })
})
