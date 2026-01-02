import { join } from 'path'
import { app } from 'electron'
import { JSONFilePreset } from 'lowdb/node'

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
  count?: number // Optional count of images
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

// LowDB schema
interface Data {
  images: Image[]
  tags: Tag[]
  image_tags: ImageTag[]
  settings: Settings
}

const defaultData: Data = {
  images: [],
  tags: [],
  image_tags: [],
  settings: { threadCount: 2 }
}
const dbPath = join(app.getPath('userData'), 'taggedviewer-db.json')

let dbPromise: Promise<any> | null = null;
class Lock {
  private promise: Promise<void> = Promise.resolve()
  async acquire() {
    let release: () => void
    const next = new Promise<void>(resolve => { release = resolve })
    const current = this.promise
    this.promise = next
    await current
    return release!
  }
}
const dbLock = new Lock()

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await JSONFilePreset<Data>(dbPath, defaultData)
      // Migration: mark existing images without processed flag as processed
      // This ensures we don't re-scan existing legacy data
      let changed = false
      db.data.images.forEach(img => {
        if (img.processed === undefined) {
          img.processed = true
          changed = true
        }
      })
      if (changed) await db.write()
      return db
    })()
  }
  return dbPromise
}

export const insertImage = {
  run: async (pt: { filepath: string }) => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      const existing = db.data.images.find((i: Image) => i.filepath === pt.filepath)
      if (!existing) {
        const newImage: Image = {
          id: Date.now() + Math.random(),
          filepath: pt.filepath,
          scanned_at: new Date().toISOString(),
          processed: false
        }
        db.data.images.push(newImage)
        await db.write()
        return { lastInsertRowid: newImage.id, inserted: true }
      }
      return { lastInsertRowid: existing.id, inserted: false }
    } finally {
      release()
    }
  }
}

export const markImageProcessed = {
  run: async (pt: { id: number }) => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      const img = db.data.images.find((i: Image) => i.id === pt.id)
      if (img) {
        img.processed = true
        await db.write()
      }
    } finally {
      release()
    }
  }
}

export const getUnprocessedImages = {
  get: async () => {
    const db = await getDb()
    return db.data.images.filter((i: Image) => !i.processed)
  }
}

export const getImage = {
  get: async (pt: { filepath: string }) => {
    const db = await getDb()
    return db.data.images.find((i: Image) => i.filepath === pt.filepath)
  }
}

export const getAllImages = {
  all: async () => {
    const db = await getDb()
    return [...db.data.images].sort((a: Image, b: Image) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())
  }
}

export const insertTag = {
  run: async (pt: { name: string }) => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      const existing = db.data.tags.find((t: Tag) => t.name === pt.name)
      if (!existing) {
        const newTag: Tag = {
          id: Date.now() + Math.random(),
          name: pt.name,
          is_favorite: false
        }
        db.data.tags.push(newTag)
        await db.write()
        return { lastInsertRowid: newTag.id }
      }
      return { lastInsertRowid: existing.id }
    } finally {
      release()
    }
  }
}

export const getTag = {
  get: async (pt: { name: string }) => {
    const db = await getDb()
    return db.data.tags.find((t: Tag) => t.name === pt.name)
  }
}

export const getAllTags = {
  all: async () => {
    const db = await getDb()
    const tags = db.data.tags.map((tag: Tag) => {
      const count = db.data.image_tags.filter((it: ImageTag) => it.tag_id === tag.id).length
      return { ...tag, count }
    })
    return tags.sort((a: Tag, b: Tag) => a.name.localeCompare(b.name))
  }
}

export const toggleFavoriteTag = {
  run: async (pt: { id: number }) => {
    const db = await getDb()
    const tag = db.data.tags.find((t: Tag) => t.id === pt.id)
    if (tag) {
      tag.is_favorite = !tag.is_favorite
      await db.write()
      return tag
    }
    return null
  }
}

export const linkImageTag = {
  run: async (pt: { imageId: number, tagId: number }) => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      const exists = db.data.image_tags.some((it: ImageTag) => it.image_id === pt.imageId && it.tag_id === pt.tagId)
      if (!exists) {
        db.data.image_tags.push({ image_id: pt.imageId, tag_id: pt.tagId, score: 1.0 })
        await db.write()
      }
    } finally {
      release()
    }
  }
}

export const getImagesByTag = {
  get: async (pt: { tagName: string }) => {
    const db = await getDb()
    const tag = db.data.tags.find((t: Tag) => t.name === pt.tagName)
    if (!tag) return []

    const imageIds = new Set(db.data.image_tags
      .filter((it: ImageTag) => it.tag_id === tag.id)
      .map((it: ImageTag) => it.image_id))

    return db.data.images
      .filter((i: Image) => imageIds.has(i.id))
      .sort((a: Image, b: Image) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())
  }
}

export const getTagsForImage = {
  get: async (pt: { imageId: number }) => {
    const db = await getDb()
    const tagIds = new Set(db.data.image_tags
      .filter((it: ImageTag) => it.image_id === pt.imageId)
      .map((it: ImageTag) => it.tag_id))

    const tags = db.data.tags
      .filter((t: Tag) => tagIds.has(t.id))
      .map((tag: Tag) => {
        const count = db.data.image_tags.filter((it: ImageTag) => it.tag_id === tag.id).length
        return { ...tag, count }
      })
    return tags.sort((a: Tag, b: Tag) => a.name.localeCompare(b.name))
  }
}

export const clearDatabase = {
  run: async () => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      db.data.images = []
      db.data.tags = []
      db.data.image_tags = []
      await db.write()
    } finally {
      release()
    }
  }
}

export const resetProcessed = {
  run: async () => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      db.data.images.forEach((img: Image) => { img.processed = false })
      await db.write()
    } finally {
      release()
    }
  }
}

export const deleteImageByPath = {
  run: async (pt: { filepath: string }) => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      const imgIndex = db.data.images.findIndex((i: Image) => i.filepath === pt.filepath)
      if (imgIndex !== -1) {
        const img = db.data.images[imgIndex]
        // Remove tags links
        db.data.image_tags = db.data.image_tags.filter((it: ImageTag) => it.image_id !== img.id)
        // Remove image
        db.data.images.splice(imgIndex, 1)
        await db.write()
        return { success: true, id: img.id }
      }
      return { success: false }
    } finally {
      release()
    }
  }
}

export const getSettings = {
  get: async () => {
    const db = await getDb()
    // Ensure settings exist (for existing databases)
    if (!db.data.settings) {
      db.data.settings = { threadCount: 2 }
      await db.write()
    }
    return db.data.settings
  }
}

export const updateSettings = {
  run: async (settings: Partial<Settings>) => {
    const release = await dbLock.acquire()
    try {
      const db = await getDb()
      db.data.settings = { ...db.data.settings, ...settings }
      await db.write()
      return db.data.settings
    } finally {
      release()
    }
  }
}

export default getDb
