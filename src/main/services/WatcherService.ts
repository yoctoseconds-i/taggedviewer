import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import { insertImagesBulk, deleteImageByPath } from '../db'
import { processQueue } from './QueueService'
import { extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

class WatcherService {
  private watcher: chokidar.FSWatcher | null = null
  private mainWindow: BrowserWindow | null = null
  private addBuffer: Set<string> = new Set()
  private removeBuffer: Set<string> = new Set()
  private flushTimeout: NodeJS.Timeout | null = null

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  async start(dirPath: string) {
    await this.stop()
    console.log(`[Watcher] Starting watch on ${dirPath}`)

    this.watcher = chokidar.watch(dirPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    })

    this.watcher
      .on('add', (path) => this.queueAction('add', path))
      .on('unlink', (path) => this.queueAction('remove', path))
      .on('error', (error) => console.error(`[Watcher] Error: ${error}`))
  }

  async stop() {
    if (this.watcher) {
      console.log('[Watcher] Stopping...')
      await this.watcher.close()
      this.watcher = null
    }
  }

  private isImage(filepath: string) {
    return IMAGE_EXTENSIONS.has(extname(filepath).toLowerCase())
  }

  private queueAction(action: 'add' | 'remove', filepath: string) {
    // Basic filter
    if (!this.isImage(filepath)) return

    if (action === 'add') {
      this.addBuffer.add(filepath)
      this.removeBuffer.delete(filepath)
    } else {
      this.removeBuffer.add(filepath)
      this.addBuffer.delete(filepath)
    }

    if (this.flushTimeout) clearTimeout(this.flushTimeout)
    this.flushTimeout = setTimeout(() => this.flush(), 2000)
  }

  private async flush() {
    const added = Array.from(this.addBuffer)
    const removed = Array.from(this.removeBuffer)
    this.addBuffer.clear()
    this.removeBuffer.clear()

    if (added.length === 0 && removed.length === 0) return

    try {
      if (removed.length > 0) {
        console.log(`[Watcher] Processing ${removed.length} removed files`)
        for (const path of removed) {
          await deleteImageByPath.run({ filepath: path })
        }
      }

      if (added.length > 0) {
        console.log(`[Watcher] Processing ${added.length} added files`)
        await insertImagesBulk.run(added)
      }

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Just reload the grid or notify
        this.mainWindow.webContents.send('scan:complete') // Or a specific event?

        if (added.length > 0) {
          // Trigger processing for new files
          processQueue(this.mainWindow)
        }
      }
    } catch (e) {
      console.error('[Watcher] Error applying changes:', e)
    }
  }
}

export const watcherService = new WatcherService()
