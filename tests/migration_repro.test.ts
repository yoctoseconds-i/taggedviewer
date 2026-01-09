import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import * as fs from 'fs'
import Database from 'better-sqlite3'

// We need to simulate the environment BEFORE db.ts is imported for the first time
// or use vi.resetModules()
describe('Database Migration', () => {
  const dbPath = join(process.cwd(), 'migration-test.sqlite')

  beforeEach(() => {
    // Clean up
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    vi.resetModules()
  })

  afterEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should migrate successfully from old schema without crashing', async () => {
    // 1. Setup Old Schema in the file that db.ts works with
    const targetDbPath = join(process.cwd(), 'taggedviewer-db-v2.sqlite')
    if (fs.existsSync(targetDbPath)) fs.unlinkSync(targetDbPath)

    const db = new Database(targetDbPath)
    db.exec(`
            CREATE TABLE images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filepath TEXT UNIQUE,
                hash TEXT,
                scanned_at TEXT,
                processed INTEGER DEFAULT 0
            );
            CREATE INDEX idx_images_scanned_at ON images(scanned_at DESC);
        `)
    db.close()

    // 2. Mock electron
    vi.setMock('electron', {
      app: {
        getPath: () => process.cwd(),
      },
    })

    // 3. Import db.ts - This triggers initialization
    // We expect this NOT to throw, but currently it SHOULD throw if bug exists
    try {
      const mod = await import('../src/main/db')
      // If it succeeds, we check if column exists
      const dbInstance = mod.default
      const info = dbInstance.prepare('PRAGMA table_info(images)').all() as any[]
      const hasCol = info.some((c) => c.name === 'file_modified_at')
      expect(hasCol).toBe(true)
    } catch (e: any) {
      // If it crashes, it's reproduced
      throw new Error('Migration crashed: ' + e.message)
    }
  })
})
