import { readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

export interface ScannedFile {
  path: string
  mtime: Date
}

export function scanDirectory(dir: string): ScannedFile[] {
  let results: ScannedFile[] = []
  try {
    const list = readdirSync(dir)
    for (const file of list) {
      const filePath = join(dir, file)
      const stat = statSync(filePath)
      if (stat && stat.isDirectory()) {
        results = results.concat(scanDirectory(filePath))
      } else {
        if (IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase())) {
          results.push({
            path: filePath,
            mtime: stat.mtime,
          })
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err)
  }
  return results
}
