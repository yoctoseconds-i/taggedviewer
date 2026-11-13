import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { rmSync, existsSync } from 'fs'

// Mock Electron's app.getPath before importing db
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return join(process.cwd(), 'out', 'test-user-data')
      return ''
    },
  },
}))

import dbManager, {
  getAllImages,
  getAllTags,
  insertImagesBulk,
  insertTag,
  linkImageTagsBulk,
  clearDatabase,
  deleteImagesBulkByPaths,
} from './db'

describe('Database Phase 1 Performance & Query Tests', () => {
  const testLibPath = join(process.cwd(), 'out', 'test-lib-phase1')

  beforeEach(async () => {
    dbManager.connect(testLibPath)
    await clearDatabase.run()
  })

  afterEach(async () => {
    if (existsSync(testLibPath)) {
      try {
        rmSync(testLibPath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup error on windows
      }
    }
  })

  it('should use expression index idx_images_date for date sorting', async () => {
    const explain = dbManager.db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM images i ORDER BY COALESCE(i.file_modified_at, i.scanned_at) DESC LIMIT 10'
      )
      .all() as { detail: string }[]

    const usesIndex = explain.some(
      (row) => row.detail.includes('idx_images_date') || row.detail.includes('USING INDEX')
    )
    expect(usesIndex).toBe(true)
  })

  it('getAllTags should accurately count tag associations including 0-count tags', async () => {
    const tag1 = await insertTag.run({ name: 'cat' })
    const tag2 = await insertTag.run({ name: 'dog' })
    await insertTag.run({ name: 'unused' })

    const images = await insertImagesBulk.run(['img1.png', 'img2.png'])

    await linkImageTagsBulk.run([
      { imageId: images[0].id, tagId: tag1.lastInsertRowid as number },
      { imageId: images[1].id, tagId: tag1.lastInsertRowid as number },
      { imageId: images[0].id, tagId: tag2.lastInsertRowid as number },
    ])

    const tags = await getAllTags.all()

    const cat = tags.find((t) => t.name === 'cat')
    const dog = tags.find((t) => t.name === 'dog')
    const unused = tags.find((t) => t.name === 'unused')

    expect(cat).toBeDefined()
    expect(cat?.count).toBe(2)
    expect(dog).toBeDefined()
    expect(dog?.count).toBe(1)
    expect(unused).toBeDefined()
    expect(unused?.count).toBe(0)
  })

  it('getAllImages should properly sort by date using file_modified_at fallback to scanned_at', async () => {
    const mtimes = {
      'old.png': '2023-01-01T00:00:00.000Z',
      'new.png': '2023-02-01T00:00:00.000Z',
    }
    await insertImagesBulk.run(['old.png', 'new.png'], mtimes)

    const desc = await getAllImages.all(10, 0, 'date', 'desc')
    expect(desc[0].filepath).toBe('new.png')
    expect(desc[1].filepath).toBe('old.png')

    const asc = await getAllImages.all(10, 0, 'date', 'asc')
    expect(asc[0].filepath).toBe('old.png')
    expect(asc[1].filepath).toBe('new.png')
  })

  it('deleteImagesBulkByPaths should batch delete multiple images and their tag associations in a single transaction', async () => {
    const images = await insertImagesBulk.run(['del1.png', 'del2.png', 'keep.png'])
    const tag = await insertTag.run({ name: 'test-tag' })

    await linkImageTagsBulk.run([
      { imageId: images[0].id, tagId: tag.lastInsertRowid as number },
      { imageId: images[1].id, tagId: tag.lastInsertRowid as number },
      { imageId: images[2].id, tagId: tag.lastInsertRowid as number },
    ])

    const deletedCount = await deleteImagesBulkByPaths.run([
      'del1.png',
      'del2.png',
      'nonexistent.png',
    ])
    expect(deletedCount).toBe(2)

    const remainingImages = await getAllImages.all()
    expect(remainingImages.length).toBe(1)
    expect(remainingImages[0].filepath).toBe('keep.png')

    const tags = await getAllTags.all()
    const testTag = tags.find((t) => t.name === 'test-tag')
    expect(testTag?.count).toBe(1)
  })
})
