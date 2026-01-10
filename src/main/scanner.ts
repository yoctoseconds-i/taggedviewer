import { promises as fs } from 'fs'
import { join, extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

export interface ScannedFile {
  path: string
  mtime: Date
}

export async function scanDirectory(
  dir: string,
  onProgress?: (file: ScannedFile) => Promise<void>
): Promise<ScannedFile[]> {
  let results: ScannedFile[] = []
  try {
    const list = await fs.readdir(dir)
    for (const file of list) {
      const filePath = join(dir, file)
      const stat = await fs.stat(filePath)
      if (stat && stat.isDirectory()) {
        results = results.concat(await scanDirectory(filePath, onProgress))
      } else {
        if (IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase())) {
          const scannedFile = {
            path: filePath,
            mtime: stat.mtime,
          }
          results.push(scannedFile)
          if (onProgress) {
            await onProgress(scannedFile)
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err)
  }
  return results
}
