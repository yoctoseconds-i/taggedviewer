import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs'
import { scanDirectory } from './scanner'
import {
  insertImage,
  getAllImages,
  getAllTags,
  getImagesByTag,
  clearDatabase,
  resetProcessed,
  toggleFavoriteTag,
  getTagsForImage,
  getSettings,
  updateSettings,
  deleteImageByPath,
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

    // Phase 1: Registration
    let registered = 0
    for (const file of files) {
      if (mainWindow.isDestroyed()) return { success: false, count: 0 }
      await insertImage.run({ filepath: file })
      registered++
      if (registered % 50 === 0) {
        mainWindow.webContents.send('scan:progress', { total: files.length, current: registered })
      }
    }

    // Phase 2: Processing Queue
    return await processQueue(mainWindow)
  })

  ipcMain.handle('scan:resume', async () => {
    return await processQueue(mainWindow)
  })

  ipcMain.handle('db:getImages', async () => {
    return await getAllImages.all()
  })

  ipcMain.handle('db:getTags', async () => {
    return await getAllTags.all()
  })

  ipcMain.handle('db:getImagesByTag', async (_, tagName: string) => {
    return await getImagesByTag.get({ tagName })
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
}
