import { join } from 'path'
import { app } from 'electron'
import { existsSync, readFileSync, renameSync } from 'fs'
const Database = require('better-sqlite3')

export interface Image {
  id: number
  filepath: string
  hash?: string
  scanned_at: string
  processed?: boolean
}

export interface Tag {
  id: number
  name: string
  count?: number
  is_favorite?: boolean
}

export interface ImageTag {
  image_id: number
  tag_id: number
  score: number
}

export interface Settings {
  threadCount: number
}

const dbPath = join(app.getPath('userData'), 'taggedviewer-db-v2.sqlite')
const oldDbPath = join(app.getPath('userData'), 'taggedviewer-db.json')
const db = new Database(dbPath)

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
      return `ORDER BY i.scanned_at ${dir}`
  }
}

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filepath TEXT UNIQUE,
    hash TEXT,
    scanned_at TEXT,
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
`)

// Migration from LowDB
if (existsSync(oldDbPath)) {
  try {
    const data = JSON.parse(readFileSync(oldDbPath, 'utf8'))
    db.transaction(() => {
      // Import images
      const insertImg = db.prepare('INSERT OR IGNORE INTO images (filepath, hash, scanned_at, processed) VALUES (?, ?, ?, ?)')
      for (const img of data.images || []) {
        insertImg.run(img.filepath, img.hash || null, img.scanned_at, img.processed ? 1 : 0)
      }

      // Import tags
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, is_favorite) VALUES (?, ?)')
      for (const tag of data.tags || []) {
        insertTag.run(tag.name, tag.is_favorite ? 1 : 0)
      }

      // Import links
      const insertLink = db.prepare('INSERT OR IGNORE INTO image_tags (image_id, tag_id, score) VALUES (?, ?, ?)')
      // We need to map old IDs to new IDs because lowdb used Date.now()
      const imgMap = new Map()
      db.prepare('SELECT id, filepath FROM images').all().forEach((row: any) => imgMap.set(row.filepath, row.id))
      const tagMap = new Map()
      db.prepare('SELECT id, name FROM tags').all().forEach((row: any) => tagMap.set(row.name, row.id))

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
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('threadCount', JSON.stringify(data.settings.threadCount))
      }
    })()
    renameSync(oldDbPath, oldDbPath + '.bak')
    console.log('[DB] Migration from JSON completed')
  } catch (e) {
    console.error('[DB] Migration failed', e)
  }
}

export const insertImagesBulk = {
  run: async (filepaths: string[]) => {
    const results: { id: number; filepath: string; inserted: boolean }[] = []
    const checkStmt = db.prepare('SELECT id FROM images WHERE filepath = ?')
    const insertStmt = db.prepare('INSERT INTO images (filepath, scanned_at, processed) VALUES (?, ?, 0)')

    db.transaction(() => {
      for (const filepath of filepaths) {
        const existing = checkStmt.get(filepath) as any
        if (existing) {
          results.push({ id: existing.id, filepath, inserted: false })
        } else {
          const res = insertStmt.run(filepath, new Date().toISOString())
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
  all: async (limit: number = 100, offset: number = 0, sortBy: string = 'date', order: 'asc' | 'desc' = 'desc') => {
    return db.prepare(`
      SELECT * FROM images i
      ${getOrderByClause(sortBy, order)}
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Image[]
  },
}

export const getImageCount = {
  get: async () => {
    const res = db.prepare('SELECT COUNT(*) as count FROM images').get() as any
    return res.count
  }
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
    return db.prepare(`
      SELECT t.*, COUNT(it.image_id) as count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as Tag[]
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
    const stmt = db.prepare('INSERT OR IGNORE INTO image_tags (image_id, tag_id, score) VALUES (?, ?, ?)')
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
    const linkStmt = db.prepare('INSERT OR IGNORE INTO image_tags (image_id, tag_id, score) VALUES (?, ?, 1.0)')
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
  get: async (pt: { tagNames: string[], limit?: number, offset?: number, sortBy?: string, order?: 'asc' | 'desc' }) => {
    if (!pt.tagNames || pt.tagNames.length === 0) return []

    const placeholders = pt.tagNames.map(() => '?').join(',')
    return db.prepare(`
      SELECT i.* FROM images i
      JOIN image_tags it ON i.id = it.image_id
      JOIN tags t ON it.tag_id = t.id
      WHERE t.name IN (${placeholders})
      GROUP BY i.id
      HAVING COUNT(DISTINCT t.id) = ?
      ${getOrderByClause(pt.sortBy, pt.order)}
      LIMIT ? OFFSET ?
    `).all(...pt.tagNames, pt.tagNames.length, pt.limit || 100, pt.offset || 0) as Image[]
  },
}

export const getImagesByTagsCount = {
  get: async (pt: { tagNames: string[] }) => {
    if (!pt.tagNames || pt.tagNames.length === 0) return 0

    const placeholders = pt.tagNames.map(() => '?').join(',')
    const res = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT i.id FROM images i
        JOIN image_tags it ON i.id = it.image_id
        JOIN tags t ON it.tag_id = t.id
        WHERE t.name IN (${placeholders})
        GROUP BY i.id
        HAVING COUNT(DISTINCT t.id) = ?
      )
    `).get(...pt.tagNames, pt.tagNames.length) as any
    return res?.count || 0
  }
}

export const getTagsForImage = {
  get: async (pt: { imageId: number }) => {
    return db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM image_tags it2 WHERE it2.tag_id = t.id) as count
      FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
      ORDER BY t.name ASC
    `).all(pt.imageId) as Tag[]
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
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('threadCount') as any
    return { threadCount: row ? JSON.parse(row.value) : 2 }
  },
}

export const updateSettings = {
  run: async (settings: Partial<Settings>) => {
    if (settings.threadCount !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('threadCount', JSON.stringify(settings.threadCount))
    }
    return getSettings.get()
  },
}

export default db
