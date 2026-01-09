import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import { scanDirectory } from './scanner'
import {
  insertImagesBulk,
  getAllImages,
  getAllTags,
  clearDatabase,
  resetProcessed,
  toggleFavoriteTag,
  getTagsForImage,
  getSettings,
  updateSettings,
  deleteImageByPath,
  backfillFileDates,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  getAllTagGroups,
} from './db'
import { processQueue, setTargetThreads } from './services/QueueService'

export function setupIPC(mainWindow: BrowserWindow) {
  ipcMain.handle('db:resetProcessed', async () => {
    await resetProcessed.run()
    return true
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    if (canceled) return null
    return filePaths[0]
  })

  ipcMain.handle('scan:start', async (_, dirPath: string) => {
    console.log(`Starting scan for ${dirPath}`)
    const files = scanDirectory(dirPath)

    // Phase 1: Registration (Bulk)
    const BATCH_SIZE = 100
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (mainWindow.isDestroyed()) return { success: false, count: 0 }
      const batch = files.slice(i, i + BATCH_SIZE)

      const filepaths = batch.map((f) => f.path)
      const mtimes = batch.reduce(
        (acc, f) => {
          acc[f.path] = f.mtime.toISOString()
          return acc
        },
        {} as Record<string, string>
      )

      await insertImagesBulk.run(filepaths, mtimes)
      mainWindow.webContents.send('scan:progress', {
        total: files.length,
        current: Math.min(i + batch.length, files.length),
      })
    }

    // Phase 2: Processing Queue
    return await processQueue(mainWindow)
  })

  ipcMain.handle('scan:resume', async () => {
    return await processQueue(mainWindow)
  })

  ipcMain.handle(
    'db:getImages',
    async (_, limit?: number, offset?: number, sortBy?: string, order?: 'asc' | 'desc') => {
      return await getAllImages.all(limit, offset, sortBy, order)
    }
  )

  ipcMain.handle('db:getImageCount', async () => {
    const { getImageCount } = await import('./db')
    return await getImageCount.get()
  })

  ipcMain.handle('db:getTags', async () => {
    return await getAllTags.all()
  })

  ipcMain.handle(
    'db:getImagesByTags',
    async (
      _,
      tagNames: string[],
      limit?: number,
      offset?: number,
      sortBy?: string,
      order?: 'asc' | 'desc'
    ) => {
      const { getImagesByTags } = await import('./db')
      return await getImagesByTags.get({ tagNames, limit, offset, sortBy, order })
    }
  )

  ipcMain.handle('db:getImagesByTagsCount', async (_, tagNames: string[]) => {
    const { getImagesByTagsCount } = await import('./db')
    return await getImagesByTagsCount.get({ tagNames })
  })

  ipcMain.handle('db:clear', async () => {
    await clearDatabase.run()
    return true
  })

  ipcMain.handle('db:toggleFavoriteTag', async (_, id: number) => {
    return await toggleFavoriteTag.run({ id })
  })

  ipcMain.handle('db:getTagsForImage', async (_, imageId: number) => {
    return await getTagsForImage.get({ imageId })
  })

  ipcMain.handle('shell:showItemInFolder', async (_, filepath: string) => {
    shell.showItemInFolder(filepath)
    return true
  })

  ipcMain.handle('settings:get', async () => {
    const settings = await getSettings.get()
    setTargetThreads(settings.threadCount)
    return settings
  })

  ipcMain.handle('settings:set', async (_, settings: any) => {
    if (settings.threadCount !== undefined) {
      setTargetThreads(settings.threadCount)
    }
    return await updateSettings.run(settings)
  })

  ipcMain.handle('lib:rescan', async () => {
    const images = await getAllImages.all()
    console.log(`[IPC] Rescanning library: ${images.length} images in DB`)

    let removed = 0
    for (const img of images) {
      if (!fs.existsSync(img.filepath)) {
        await deleteImageByPath.run({ filepath: img.filepath })
        removed++
      }
    }
    console.log(`[IPC] Rescan: removed ${removed} missing images.`)

    await resetProcessed.run()
    // Start processing queue in background
    processQueue(mainWindow)
    return { success: true, removedCount: removed }
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:checkForUpdates', async () => {
    if (app.isPackaged) {
      return await autoUpdater.checkForUpdatesAndNotify()
    }
    return null
  })

  // Trigger one-time backfill on startup if needed (called from renderer or just exposes it)
  // For now we can just run it once at startup or via a manual trigger.
  // Let's explicitly call it when setupIPC is done or expose it.
  // Since this might take time, let's just expose it for now or rely on the fact that scanning triggers it? No.
  // Let's add an explicit IPC to trigger maintenance tasks.
  ipcMain.handle('db:maintenance:fixDates', async () => {
    console.log('[IPC] Starting date backfill...')
    const result = await backfillFileDates.run()
    console.log(`[IPC] Date backfill completed: ${result.count} updated.`)
    return result
  })

  // Tag Groups
  ipcMain.handle(
    'db:createTagGroup',
    async (_, { name, tagIds }: { name: string; tagIds: number[] }) => {
      return await createTagGroup.run({ name, tagIds })
    }
  )

  ipcMain.handle(
    'db:updateTagGroup',
    async (_, { id, name, tagIds }: { id: number; name: string; tagIds: number[] }) => {
      return await updateTagGroup.run({ id, name, tagIds })
    }
  )

  ipcMain.handle('db:deleteTagGroup', async (_, { id }: { id: number }) => {
    return await deleteTagGroup.run({ id })
  })

  ipcMain.handle('db:getTagGroups', async () => {
    return await getAllTagGroups.get()
  })
}
