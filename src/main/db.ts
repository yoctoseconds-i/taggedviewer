import { join } from 'path'
import { app } from 'electron'
import { existsSync, renameSync, statSync, mkdirSync, copyFileSync } from 'fs'
const Database = require('better-sqlite3')
import { scanDirectory } from './scanner'

export interface Image {
  id: number
  filepath: string
  hash?: string
  scanned_at: string
  file_modified_at?: string
  processed?: boolean
}

export interface Tag {
  id: number
  name: string
  count?: number
  is_favorite?: boolean
  is_hidden?: boolean
}

export interface TagGroup {
  id: number
  name: string
  tags: Tag[]
}

export interface ImageTag {
  image_id: number
  tag_id: number
  score: number
}

// Per-library settings
export interface Settings {
  threadCount: number
  language?: string
  // Library Path is no longer stored here as a setting effectively,
  // but we might keep it for legacy reasons or UI logic, but it's redundant
  // as the db IS in the library path.
  libraryPath?: string
  watchEnabled?: boolean
}

const getUserDataPath = () => {
  try {
    return app.getPath('userData')
  } catch {
    // Fallback for tests or non-electron environments
    return join(process.cwd(), 'out', 'test-user-data')
  }
}

// Global legacy paths for migration
const legacyDbPath = join(getUserDataPath(), 'taggedviewer-db-v2.sqlite')

class DatabaseManager {
  private _db: any = null
  private currentLibraryPath: string | null = null

  get db() {
    if (!this._db) {
      throw new Error('Database not connected. Please open a library first.')
    }
    return this._db
  }

  isOpen(): boolean {
    return !!this._db
  }

  getCurrentLibraryPath() {
    return this.currentLibraryPath
  }

  connect(libraryPath: string) {
    if (this._db) {
      this._db.close()
      this._db = null
    }

    if (!existsSync(libraryPath)) {
      mkdirSync(libraryPath, { recursive: true })
    }

    const dotDir = join(libraryPath, '.taggedviewer')
    if (!existsSync(dotDir)) {
      mkdirSync(dotDir, { recursive: true })
    }

    const dbPath = join(dotDir, 'taggedviewer.sqlite')
    console.log(`[DB] Connecting to ${dbPath}`)

    this._db = new Database(dbPath)
    this.currentLibraryPath = libraryPath
    this.initPragma()
    this.initSchema()

    // Ensure we have libraryPath set in settings for consistency
    const currentSettings = getSettings.get()
    if (currentSettings.libraryPath !== libraryPath) {
      updateSettings.run({ libraryPath })
    }
  }

  private initPragma() {
    this._db.pragma('journal_mode = WAL')
    this._db.pragma('synchronous = NORMAL')
    this._db.pragma('temp_store = MEMORY')
    this._db.pragma('cache_size = -64000') // 64MB cache

    // Custom function to get file extension
    try {
      this._db.function('GetExtension', (filepath: string) => {
        if (!filepath) return ''
        const parts = filepath.split('.')
        return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
      })
    } catch {
      // Ignore if already registered (though unlikely with new connection)
    }
  }

  private initSchema() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filepath TEXT UNIQUE,
        hash TEXT,
        scanned_at TEXT,
        file_modified_at TEXT,
        processed INTEGER DEFAULT 0
      );
    
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        is_favorite INTEGER DEFAULT 0,
        is_hidden INTEGER DEFAULT 0
      );
    
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id INTEGER,
        tag_id INTEGER,
        score REAL,
        PRIMARY KEY (image_id, tag_id),
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    
      CREATE INDEX IF NOT EXISTS idx_images_scanned_at ON images(scanned_at DESC);
      CREATE INDEX IF NOT EXISTS idx_image_tags_tag_id ON image_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_image_tags_composite ON image_tags(tag_id, image_id);
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
      CREATE INDEX IF NOT EXISTS idx_images_file_modified_at ON images(file_modified_at DESC);
      
      CREATE TABLE IF NOT EXISTS tag_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      );
    
      CREATE TABLE IF NOT EXISTS tag_group_tags (
        group_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (group_id, tag_id),
        FOREIGN KEY (group_id) REFERENCES tag_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `)
  }

  // Attempt to migrate from legacy global DB to a library-specific DB
  // Returns the path of the library migrated to, or null if no migration happened
  tryMigrateLegacy(): string | null {
    if (existsSync(legacyDbPath)) {
      console.log('[DB] Found legacy database, checking for migration...')
      try {
        const legacyDb = new Database(legacyDbPath)
        const row = legacyDb
          .prepare('SELECT value FROM settings WHERE key = ?')
          .get('libraryPath') as any
        const libraryPath = row ? JSON.parse(row.value) : null
        legacyDb.close()

        if (libraryPath && existsSync(libraryPath)) {
          console.log(`[DB] Migrating legacy DB to ${libraryPath}`)
          const dotDir = join(libraryPath, '.taggedviewer')
          if (!existsSync(dotDir)) {
            mkdirSync(dotDir, { recursive: true })
          }
          const targetDbPath = join(dotDir, 'taggedviewer.sqlite')
          if (!existsSync(targetDbPath)) {
            copyFileSync(legacyDbPath, targetDbPath)
            console.log('[DB] Migration successful.')
            // Rename legacy to avoid re-migration
            renameSync(legacyDbPath, legacyDbPath + '.migrated')
            return libraryPath
          }
        }
      } catch (e) {
        console.error('[DB] Migration failed', e)
      }
    }
    return null
  }
}

export const dbManager = new DatabaseManager()

const getOrderByClause = (sortBy: string = 'date', order: 'asc' | 'desc' = 'desc') => {
  const dir = order === 'asc' ? 'ASC' : 'DESC'
  switch (sortBy) {
    case 'name':
      return `ORDER BY i.filepath ${dir}`
    case 'ext':
      return `ORDER BY GetExtension(i.filepath) ${dir}, i.filepath ${dir}`
    case 'random':
      return 'ORDER BY RANDOM()'
    case 'date':
    default:
      return `ORDER BY COALESCE(i.file_modified_at, i.scanned_at) ${dir}`
  }
}

// --- Helpers wrapping dbManager.db ---

export const insertImagesBulk = {
  run: async (filepaths: string[], mtimes?: Record<string, string>) => {
    const db = dbManager.db
    const results: { id: number; filepath: string; inserted: boolean }[] = []
    const checkStmt = db.prepare('SELECT id FROM images WHERE filepath = ?')
    const insertStmt = db.prepare(
      'INSERT INTO images (filepath, scanned_at, file_modified_at, processed) VALUES (?, ?, ?, 0)'
    )

    db.transaction(() => {
      for (const filepath of filepaths) {
        const existing = checkStmt.get(filepath) as any
        if (existing) {
          results.push({ id: existing.id, filepath, inserted: false })
        } else {
          const mtime = mtimes ? mtimes[filepath] : null
          const res = insertStmt.run(filepath, new Date().toISOString(), mtime)
          results.push({ id: res.lastInsertRowid as number, filepath, inserted: true })
        }
      }
    })()
    return results
  },
}

export const insertImage = {
  run: async (pt: { filepath: string }) => {
    const results = await insertImagesBulk.run([pt.filepath])
    const res = results[0]
    return { lastInsertRowid: res.id, inserted: res.inserted }
  },
}

export const markImageProcessed = {
  run: async (pt: { id: number }) => {
    dbManager.db.prepare('UPDATE images SET processed = 1 WHERE id = ?').run(pt.id)
  },
}

export const getUnprocessedImages = {
  get: async () => {
    return dbManager.db.prepare('SELECT * FROM images WHERE processed = 0').all() as Image[]
  },
}

export const getImage = {
  get: async (pt: { filepath: string }) => {
    return dbManager.db.prepare('SELECT * FROM images WHERE filepath = ?').get(pt.filepath) as Image
  },
}

export const getAllImages = {
  all: async (
    limit: number = 100,
    offset: number = 0,
    sortBy: string = 'date',
    order: 'asc' | 'desc' = 'desc'
  ) => {
    return dbManager.db
      .prepare(
        `
      SELECT * FROM images i
      ${getOrderByClause(sortBy, order)}
      LIMIT ? OFFSET ?
    `
      )
      .all(limit, offset) as Image[]
  },
}

export const getImageCount = {
  get: async () => {
    const res = dbManager.db.prepare('SELECT COUNT(*) as count FROM images').get() as any
    return res.count
  },
}

export const insertTagsBulk = {
  run: async (names: string[]) => {
    const db = dbManager.db
    const stmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
    db.transaction(() => {
      for (const name of names) {
        const trimmed = name.trim()
        if (trimmed) stmt.run(trimmed)
      }
    })()
  },
}

export const insertTag = {
  run: async (pt: { name: string }) => {
    const db = dbManager.db
    const res = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(pt.name.trim())
    if (res.changes > 0) return { lastInsertRowid: res.lastInsertRowid }
    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(pt.name.trim()) as any
    return { lastInsertRowid: existing?.id }
  },
}

export const getAllTags = {
  all: async () => {
    return dbManager.db
      .prepare(
        `
      SELECT t.*, COUNT(it.image_id) as count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY t.is_hidden ASC, t.name ASC
    `
      )
      .all() as Tag[]
  },
}

export const toggleFavoriteTag = {
  run: async (pt: { id: number }) => {
    const db = dbManager.db
    db.prepare('UPDATE tags SET is_favorite = 1 - is_favorite WHERE id = ?').run(pt.id)
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(pt.id) as Tag
  },
}

export const toggleHiddenTag = {
  run: async (pt: { id: number }) => {
    const db = dbManager.db
    db.prepare('UPDATE tags SET is_hidden = 1 - is_hidden WHERE id = ?').run(pt.id)
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(pt.id) as Tag
  },
}

export const linkImageTagsBulk = {
  run: async (links: { imageId: number; tagId: number }[]) => {
    const db = dbManager.db
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO image_tags (image_id, tag_id, score) VALUES (?, ?, ?)'
    )
    db.transaction(() => {
      for (const link of links) {
        stmt.run(link.imageId, link.tagId, 1.0)
      }
    })()
  },
}

export const processImageResultsBulk = {
  run: async (imageResults: { imageId: number; tagNames: string[] }[]) => {
    const db = dbManager.db
    const insertTagStmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
    const getTagIdStmt = db.prepare('SELECT id FROM tags WHERE name = ?')
    const linkStmt = db.prepare(
      'INSERT OR IGNORE INTO image_tags (image_id, tag_id, score) VALUES (?, ?, 1.0)'
    )
    const markDoneStmt = db.prepare('UPDATE images SET processed = 1 WHERE id = ?')

    db.transaction(() => {
      for (const res of imageResults) {
        for (const rawName of res.tagNames) {
          const name = rawName.trim()
          if (!name) continue
          insertTagStmt.run(name)
          const tag = getTagIdStmt.get(name) as any
          if (tag) {
            linkStmt.run(res.imageId, tag.id)
          }
        }
        markDoneStmt.run(res.imageId)
      }
    })()
  },
}

export const getImagesByTags = {
  get: async (pt: {
    tagNames: string[]
    limit?: number
    offset?: number
    sortBy?: string
    order?: 'asc' | 'desc'
  }) => {
    if (!pt.tagNames || pt.tagNames.length === 0) return []

    const placeholders = pt.tagNames.map(() => '?').join(',')
    return dbManager.db
      .prepare(
        `
      SELECT i.* FROM images i
      JOIN image_tags it ON i.id = it.image_id
      JOIN tags t ON it.tag_id = t.id
      WHERE t.name IN (${placeholders})
      GROUP BY i.id
      HAVING COUNT(DISTINCT t.id) = ?
      ${getOrderByClause(pt.sortBy, pt.order)}
      LIMIT ? OFFSET ?
    `
      )
      .all(...pt.tagNames, pt.tagNames.length, pt.limit || 100, pt.offset || 0) as Image[]
  },
}

export const getImagesByTagsCount = {
  get: async (pt: { tagNames: string[] }) => {
    if (!pt.tagNames || pt.tagNames.length === 0) return 0

    const placeholders = pt.tagNames.map(() => '?').join(',')
    const res = dbManager.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM (
        SELECT i.id FROM images i
        JOIN image_tags it ON i.id = it.image_id
        JOIN tags t ON it.tag_id = t.id
        WHERE t.name IN (${placeholders})
        GROUP BY i.id
        HAVING COUNT(DISTINCT t.id) = ?
      )
    `
      )
      .get(...pt.tagNames, pt.tagNames.length) as any
    return res?.count || 0
  },
}

export const getTagsForImage = {
  get: async (pt: { imageId: number }) => {
    return dbManager.db
      .prepare(
        `
      SELECT t.*, (SELECT COUNT(*) FROM image_tags it2 WHERE it2.tag_id = t.id) as count
      FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
      ORDER BY t.is_hidden ASC, t.name ASC
    `
      )
      .all(pt.imageId) as Tag[]
  },
}

export const clearDatabase = {
  run: async () => {
    const db = dbManager.db
    db.transaction(() => {
      db.prepare('DELETE FROM image_tags').run()
      db.prepare('DELETE FROM images').run()
      db.prepare('DELETE FROM tags').run()
    })()
  },
}

export const resetProcessed = {
  run: async () => {
    dbManager.db.prepare('UPDATE images SET processed = 0').run()
  },
}

export const deleteImageByPath = {
  run: async (pt: { filepath: string }) => {
    const db = dbManager.db
    const img = db.prepare('SELECT id FROM images WHERE filepath = ?').get(pt.filepath) as any
    if (img) {
      db.transaction(() => {
        db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(img.id)
        db.prepare('DELETE FROM images WHERE id = ?').run(img.id)
      })()
      return { success: true, id: img.id }
    }
    return { success: false }
  },
}

export const getSettings = {
  get: async () => {
    const db = dbManager.db
    const threadRow = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('threadCount') as any
    const langRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('language') as any
    const libRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('libraryPath') as any
    const watchRow = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('watchEnabled') as any
    const settings: Settings = {
      threadCount: threadRow ? JSON.parse(threadRow.value) : 2,
      language: langRow ? JSON.parse(langRow.value) : 'en',
      libraryPath: libRow ? JSON.parse(libRow.value) : undefined,
      watchEnabled: watchRow ? JSON.parse(watchRow.value) : false,
    }
    return settings
  },
}

export const updateSettings = {
  run: async (settings: Partial<Settings>) => {
    const db = dbManager.db
    if (settings.threadCount !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'threadCount',
        JSON.stringify(settings.threadCount)
      )
    }
    if (settings.language !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'language',
        JSON.stringify(settings.language)
      )
    }
    if (settings.libraryPath !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'libraryPath',
        JSON.stringify(settings.libraryPath)
      )
    }
    if (settings.watchEnabled !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'watchEnabled',
        JSON.stringify(settings.watchEnabled)
      )
    }
    return getSettings.get()
  },
}

export const createTagGroup = {
  run: async (pt: { name: string; tagIds: number[] }) => {
    const db = dbManager.db
    const insertGroup = db.prepare('INSERT INTO tag_groups (name) VALUES (?)')
    const insertLink = db.prepare('INSERT INTO tag_group_tags (group_id, tag_id) VALUES (?, ?)')

    let groupId: number | bigint = 0
    db.transaction(() => {
      const res = insertGroup.run(pt.name)
      groupId = res.lastInsertRowid
      for (const tagId of pt.tagIds) {
        insertLink.run(groupId, tagId)
      }
    })()

    return getAllTagGroups.get()
  },
}

export const updateTagGroup = {
  run: async (pt: { id: number; name: string; tagIds: number[] }) => {
    const db = dbManager.db
    const updateGroup = db.prepare('UPDATE tag_groups SET name = ? WHERE id = ?')
    const deleteLinks = db.prepare('DELETE FROM tag_group_tags WHERE group_id = ?')
    const insertLink = db.prepare('INSERT INTO tag_group_tags (group_id, tag_id) VALUES (?, ?)')

    db.transaction(() => {
      updateGroup.run(pt.name, pt.id)
      deleteLinks.run(pt.id)
      for (const tagId of pt.tagIds) {
        insertLink.run(pt.id, tagId)
      }
    })()

    return getAllTagGroups.get()
  },
}

export const deleteTagGroup = {
  run: async (pt: { id: number }) => {
    dbManager.db.prepare('DELETE FROM tag_groups WHERE id = ?').run(pt.id)
    return getAllTagGroups.get()
  },
}

export const getAllTagGroups = {
  get: async () => {
    const db = dbManager.db
    const groups = db.prepare('SELECT * FROM tag_groups ORDER BY name ASC').all() as any[]

    const groupsWithTags = groups.map((group) => {
      const tags = db
        .prepare(
          `
        SELECT t.* 
        FROM tags t
        JOIN tag_group_tags tgt ON t.id = tgt.tag_id
        WHERE tgt.group_id = ?
        ORDER BY t.name ASC
      `
        )
        .all(group.id) as Tag[]
      return { ...group, tags } as TagGroup
    })

    return groupsWithTags
  },
}

export const syncLibrary = {
  run: async (mainWindow?: any, options: { skipScan?: boolean; skipCleanup?: boolean } = {}) => {
    // With library switching, we just sync the current OPEN library
    const libPath = dbManager.getCurrentLibraryPath()
    if (!libPath || !existsSync(libPath)) {
      console.log('[DB] Library sync skipped: libraryPath not set or invalid.')
      return { added: 0, removed: 0 }
    }

    let files: any[] = []
    let filePaths = new Set<string>()

    if (!options.skipScan) {
      console.log(`[DB] Starting library sync for: ${libPath}`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:start')
      }

      files = await scanDirectory(libPath)
      console.log(`[DB] Scanned ${files.length} files.`)
      filePaths = new Set(files.map((f: any) => f.path))
    }

    let addedCount = 0
    let removedCount = 0

    const db = dbManager.db

    // 1. Find and add new files
    const BATCH_SIZE = 100
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (mainWindow && mainWindow.isDestroyed()) break
      const batch = files.slice(i, i + BATCH_SIZE)
      const batchPaths = batch.map((f: any) => f.path)
      const mtimes = batch.reduce(
        (acc: any, f: any) => {
          acc[f.path] = f.mtime.toISOString()
          return acc
        },
        {} as Record<string, string>
      )

      const results = await insertImagesBulk.run(batchPaths, mtimes)
      addedCount += results.filter((r) => r.inserted).length

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:progress', {
          total: files.length,
          current: Math.min(i + batch.length, files.length),
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    if (options.skipCleanup) {
      console.log(`[DB] Library sync (partial) completed. Added: ${addedCount}`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan:complete')
      }
      return { added: addedCount, removed: 0 }
    }

    // 2. Remove missing files (scope: everything in current library path)
    const escapeLike = (str: string) => str.replace(/[%_]/g, '\\$&')
    const pattern = escapeLike(libPath) + '%'
    // We strictly only manage files INSIDE the library path now
    const imagesInScope = db
      .prepare("SELECT id, filepath FROM images WHERE filepath LIKE ? ESCAPE '\\'")
      .all(pattern) as Image[]

    if (options.skipScan) {
      console.log(`[DB] Scanning directory for cleanup: ${libPath}`)
      files = await scanDirectory(libPath)
      filePaths = new Set(files.map((f: any) => f.path))
    }

    const toDelete: string[] = []
    for (const img of imagesInScope) {
      if (!filePaths.has(img.filepath)) {
        toDelete.push(img.filepath)
      }
    }

    if (toDelete.length > 0) {
      console.log(`[DB] Sync: Removing ${toDelete.length} missing files in scope.`)
      for (let i = 0; i < toDelete.length; i++) {
        if (mainWindow && mainWindow.isDestroyed()) break
        await deleteImageByPath.run({ filepath: toDelete[i] })
        removedCount++

        if (i % 50 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
    }

    console.log(`[DB] Library sync completed. Added: ${addedCount}, Removed: ${removedCount}`)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:complete')
    }

    return { added: addedCount, removed: removedCount }
  },
}

export const backfillFileDates = {
  run: async () => {
    const db = dbManager.db
    const images = db
      .prepare('SELECT id, filepath FROM images WHERE file_modified_at IS NULL')
      .all() as Image[]
    if (images.length === 0) return { count: 0 }

    const updateStmt = db.prepare('UPDATE images SET file_modified_at = ? WHERE id = ?')
    let updated = 0

    const BATCH_SIZE = 100
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE)
      db.transaction(() => {
        for (const img of batch) {
          try {
            if (existsSync(img.filepath)) {
              const stats = statSync(img.filepath)
              updateStmt.run(stats.mtime.toISOString(), img.id)
              updated++
            }
          } catch {
            // ignore missing files
          }
        }
      })()
      await new Promise((resolve) => setImmediate(resolve))
    }
    return { count: updated }
  },
}

export default dbManager
