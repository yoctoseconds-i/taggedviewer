import { promises as fs } from 'fs'
import { join, extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
const IGNORED_DIRECTORIES = new Set([
  '.taggedviewer',
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '$recycle.bin',
  'system volume information',
])

export interface ScannedFile {
  path: string
  mtime: Date
}

// 同時並行数制御付きの stat 取得ヘルパー
async function getFileStatsWithLimit(
  filePaths: string[],
  concurrency = 32,
  onProgress?: (file: ScannedFile) => Promise<void>
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = []

  for (let i = 0; i < filePaths.length; i += concurrency) {
    const chunk = filePaths.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map(async (filePath) => {
        try {
          const stat = await fs.stat(filePath)
          return {
            path: filePath,
            mtime: stat.mtime,
          }
        } catch {
          return null
        }
      })
    )

    for (const file of chunkResults) {
      if (file) {
        results.push(file)
        if (onProgress) {
          await onProgress(file)
        }
      }
    }
  }

  return results
}

export async function scanDirectory(
  dir: string,
  onProgress?: (file: ScannedFile) => Promise<void>
): Promise<ScannedFile[]> {
  let results: ScannedFile[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const candidateFiles: string[] = []
    const subDirs: string[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase()
        if (entry.name.startsWith('.') || IGNORED_DIRECTORIES.has(lowerName)) {
          continue
        }
        subDirs.push(join(dir, entry.name))
      } else if (entry.isFile()) {
        if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          candidateFiles.push(join(dir, entry.name))
        }
      }
    }

    // 画像ファイルの stat を並行取得
    if (candidateFiles.length > 0) {
      const scannedFiles = await getFileStatsWithLimit(candidateFiles, 32, onProgress)
      results = results.concat(scannedFiles)
    }

    // サブディレクトリの再帰スキャン
    for (const subDir of subDirs) {
      results = results.concat(await scanDirectory(subDir, onProgress))
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err)
  }
  return results
}
