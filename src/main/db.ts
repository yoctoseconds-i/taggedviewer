import { join } from 'path'
import { app } from 'electron'
import { existsSync, readFileSync, renameSync, statSync } from 'fs'
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

export interface Settings {
  threadCount: number
  language?: string
  libraryPath?: string
}

const getUserDataPath = () => {
  try {
    return app.getPath('userData')
  } catch {
    // Fallback for tests or non-electron environments
    return join(process.cwd(), 'out', 'test-user-data')
  }
}

const dbPath = join(getUserDataPath(), 'taggedviewer-db-v2.sqlite')
const oldDbPath = join(getUserDataPath(), 'taggedviewer-db.json')
const db = new Database(dbPath)

// Performance Optimizations
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('temp_store = MEMORY')
db.pragma('cache_size = -64000') // 64MB cache

// Custom function to get file extension
db.function('GetExtension', (filepath: string) => {
  if (!filepath) return ''
  const parts = filepath.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
})

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
      // Fallback to scanned_at if file_modified_at is null
      return `ORDER BY COALESCE(i.file_modified_at, i.scanned_at) ${dir}`
  }
}

// Initialize schema
db.exec(`
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
    is_favorite INTEGER DEFAULT 0
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

// Migration from LowDB
if (existsSync(oldDbPath)) {
  try {
    const data = JSON.parse(readFileSync(oldDbPath, 'utf8'))
    db.transaction(() => {
      // Import images
      const insertImg = db.prepare(
        'INSERT OR IGNORE INTO images (filepath, hash, scanned_at, processed) VALUES (?, ?, ?, ?)'
      )
      for (const img of data.images || []) {
        insertImg.run(img.filepath, img.hash || null, img.scanned_at, img.processed ? 1 : 0)
      }

      // Import tags
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, is_favorite) VALUES (?, ?)')
      for (const tag of data.tags || []) {
        insertTag.run(tag.name, tag.is_favorite ? 1 : 0)
      }

      // Import links
      const insertLink = db.prepare(
        'INSERT OR IGNORE INTO image_tags (image_id, tag_id, score) VALUES (?, ?, ?)'
      )
      // We need to map old IDs to new IDs because lowdb used Date.now()
      const imgMap = new Map()
      db.prepare('SELECT id, filepath FROM images')
        .all()
        .forEach((row: any) => imgMap.set(row.filepath, row.id))
      const tagMap = new Map()
      db.prepare('SELECT id, name FROM tags')
        .all()
        .forEach((row: any) => tagMap.set(row.name, row.id))

      const oldImgMap = new Map()
      for (const img of data.images || []) oldImgMap.set(img.id, img.filepath)
      const oldTagMap = new Map()
      for (const tag of data.tags || []) oldTagMap.set(tag.id, tag.name)

      for (const link of data.image_tags || []) {
        const filepath = oldImgMap.get(link.image_id)
        const tagName = oldTagMap.get(link.tag_id)
        const newImgId = imgMap.get(filepath)
        const newTagId = tagMap.get(tagName)
        if (newImgId && newTagId) {
          insertLink.run(newImgId, newTagId, link.score || 1.0)
        }
      }

      // Settings
      if (data.settings) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'threadCount',
          JSON.stringify(data.settings.threadCount)
        )
      }
    })()
    renameSync(oldDbPath, oldDbPath + '.bak')
    console.log('[DB] Migration from JSON completed')
  } catch (e) {
    console.error('[DB] Migration failed', e)
  }
}

// Migration: Add file_modified_at if missing
try {
  const tableInfo = db.prepare('PRAGMA table_info(images)').all()
  const hasModifiedAt = tableInfo.some((col: any) => col.name === 'file_modified_at')
  if (!hasModifiedAt) {
    console.log('[DB] Applying migration: Add file_modified_at column')
    db.prepare('ALTER TABLE images ADD COLUMN file_modified_at TEXT').run()
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_images_file_modified_at ON images(file_modified_at DESC)'
    ).run()
  }
} catch (e) {
  console.error('[DB] Schema migration failed', e)
}

// Ensure index exists (safe to run after migration/table creation)
try {
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_images_file_modified_at ON images(file_modified_at DESC)'
  ).run()
} catch (e) {
  console.error('[DB] Index creation failed', e)
}

export const insertImagesBulk = {
  run: async (filepaths: string[], mtimes?: Record<string, string>) => {
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
          // Optionally update mtime if existing?
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
    db.prepare('UPDATE images SET processed = 1 WHERE id = ?').run(pt.id)
  },
}

export const getUnprocessedImages = {
  get: async () => {
    return db.prepare('SELECT * FROM images WHERE processed = 0').all() as Image[]
  },
}

export const getImage = {
  get: async (pt: { filepath: string }) => {
    return db.prepare('SELECT * FROM images WHERE filepath = ?').get(pt.filepath) as Image
  },
}

export const getAllImages = {
  all: async (
    limit: number = 100,
    offset: number = 0,
    sortBy: string = 'date',
    order: 'asc' | 'desc' = 'desc'
  ) => {
    return db
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
    const res = db.prepare('SELECT COUNT(*) as count FROM images').get() as any
    return res.count
  },
}

export const insertTagsBulk = {
  run: async (names: string[]) => {
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
    const res = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(pt.name.trim())
    if (res.changes > 0) return { lastInsertRowid: res.lastInsertRowid }
    const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(pt.name.trim()) as any
    return { lastInsertRowid: existing?.id }
  },
}

export const getAllTags = {
  all: async () => {
    // High performance tag counting using SQL
    return db
      .prepare(
        `
      SELECT t.*, COUNT(it.image_id) as count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `
      )
      .all() as Tag[]
  },
}

export const toggleFavoriteTag = {
  run: async (pt: { id: number }) => {
    db.prepare('UPDATE tags SET is_favorite = 1 - is_favorite WHERE id = ?').run(pt.id)
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(pt.id) as Tag
  },
}

export const linkImageTagsBulk = {
  run: async (links: { imageId: number; tagId: number }[]) => {
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
    return db
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
    const res = db
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
    return db
      .prepare(
        `
      SELECT t.*, (SELECT COUNT(*) FROM image_tags it2 WHERE it2.tag_id = t.id) as count
      FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
      ORDER BY t.name ASC
    `
      )
      .all(pt.imageId) as Tag[]
  },
}

export const clearDatabase = {
  run: async () => {
    db.transaction(() => {
      db.prepare('DELETE FROM image_tags').run()
      db.prepare('DELETE FROM images').run()
      db.prepare('DELETE FROM tags').run()
    })()
  },
}

export const resetProcessed = {
  run: async () => {
    db.prepare('UPDATE images SET processed = 0').run()
  },
}

export const deleteImageByPath = {
  run: async (pt: { filepath: string }) => {
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
    const threadRow = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('threadCount') as any
    const langRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('language') as any
    const libRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('libraryPath') as any
    const settings: Settings = {
      threadCount: threadRow ? JSON.parse(threadRow.value) : 2,
      language: langRow ? JSON.parse(langRow.value) : 'en',
      libraryPath: libRow ? JSON.parse(libRow.value) : undefined,
    }
    return settings
  },
}

export const updateSettings = {
  run: async (settings: Partial<Settings>) => {
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
    return getSettings.get()
  },
}

// Backfill utility

export const createTagGroup = {
  run: async (pt: { name: string; tagIds: number[] }) => {
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
    db.prepare('DELETE FROM tag_groups WHERE id = ?').run(pt.id)
    return getAllTagGroups.get()
  },
}

export const getAllTagGroups = {
  get: async () => {
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
    const settings = await getSettings.get()
    const libPath = settings.libraryPath
    if (!libPath || !existsSync(libPath)) {
      console.log('[DB] Library sync skipped: libraryPath not set or invalid.')
      return { added: 0, removed: 0 }
    }

    let files: any[] = []
    let filePaths = new Set<string>()

    if (!options.skipScan) {
      console.log(`[DB] Starting library sync for: ${libPath}`)
      files = await scanDirectory(libPath)
      filePaths = new Set(files.map((f: any) => f.path))
    }

    let addedCount = 0
    let removedCount = 0

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

      // Yield to event loop to keep UI responsive
      await new Promise((resolve) => setImmediate(resolve))
    }

    if (options.skipCleanup) {
      console.log(`[DB] Library sync (partial) completed. Added: ${addedCount}`)
      return { added: addedCount, removed: 0 }
    }

    // 2. Remove missing files from DB that should be in libraryPath
    // Optimization: Only query images that start with libPath
    const escapeLike = (str: string) => str.replace(/[%_]/g, '\\$&')
    const pattern = escapeLike(libPath) + '%'
    const imagesInScope = db
      .prepare("SELECT id, filepath FROM images WHERE filepath LIKE ? ESCAPE '\\'")
      .all(pattern) as Image[]

    // If skipScan was true, we don't have filePaths set.
    // If we want to cleanup WITHOUT scanning for NEW files, we still need the current folder state to know what's REMOVED.
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

        // Yield occasionally
        if (i % 50 === 0) {
          await new Promise((resolve) => setImmediate(resolve))
        }
      }
    }

    console.log(`[DB] Library sync completed. Added: ${addedCount}, Removed: ${removedCount}`)
    return { added: addedCount, removed: removedCount }
  },
}

export const backfillFileDates = {
  run: async () => {
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
      // Yield to event loop
      await new Promise((resolve) => setImmediate(resolve))
    }
    return { count: updated }
  },
}

export default db
