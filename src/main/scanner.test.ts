import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { scanDirectory } from './scanner'

describe('scanner', () => {
  const testDir = join(process.cwd(), 'out', 'test-scanner-dir')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors on Windows
      }
    }
  })

  it('scans images and ignores non-images and hidden directories', async () => {
    // 正常な画像ファイル
    writeFileSync(join(testDir, 'image1.jpg'), 'fake-jpg')
    writeFileSync(join(testDir, 'image2.png'), 'fake-png')

    // 非画像ファイル
    writeFileSync(join(testDir, 'notes.txt'), 'text')

    // サブディレクトリ内の画像
    const subDir = join(testDir, 'sub')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'image3.webp'), 'fake-webp')

    // 除外対象ディレクトリ (.taggedviewer, .git)
    const dotDir = join(testDir, '.taggedviewer')
    mkdirSync(dotDir, { recursive: true })
    writeFileSync(join(dotDir, 'should_ignore.png'), 'fake-png')

    const gitDir = join(testDir, '.git')
    mkdirSync(gitDir, { recursive: true })
    writeFileSync(join(gitDir, 'git_ignore.jpg'), 'fake-jpg')

    const progressFiles: string[] = []
    const results = await scanDirectory(testDir, async (file) => {
      progressFiles.push(file.path)
    })

    const foundPaths = results.map((r) => r.path)
    expect(foundPaths.length).toBe(3)
    expect(progressFiles.length).toBe(3)

    expect(foundPaths.some((p) => p.endsWith('image1.jpg'))).toBe(true)
    expect(foundPaths.some((p) => p.endsWith('image2.png'))).toBe(true)
    expect(foundPaths.some((p) => p.endsWith('image3.webp'))).toBe(true)
    expect(foundPaths.some((p) => p.includes('.taggedviewer'))).toBe(false)
    expect(foundPaths.some((p) => p.includes('.git'))).toBe(false)
    expect(foundPaths.some((p) => p.endsWith('notes.txt'))).toBe(false)
  })
})
