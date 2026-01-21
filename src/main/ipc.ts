import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { scanDirectory } from './scanner'
import dbManager, {
  insertImagesBulk,
  getAllImages,
  getAllTags,
  clearDatabase,
  resetProcessed,
  toggleHiddenTag,
  toggleFavoriteTag,
  getTagsForImage,
  getSettings,
  updateSettings,
  deleteTagGroup,
  getAllTagGroups,
  syncLibrary,
  backfillFileDates,
  createTagGroup,
  updateTagGroup,
} from './db'
import { processQueue, setTargetThreads } from './services/QueueService'
import { globalSettings } from './GlobalSettings'
import { watcherService } from './services/WatcherService'

export function setupIPC(mainWindow: BrowserWindow) {
  // Initialization: Try to migrate or open last library
  watcherService.setMainWindow(mainWindow)

  const checkAutoSync = async (libPath: string) => {
    console.log(`[AutoSync] Checking for ${libPath}...`)
    try {
      const settings = await getSettings.get()
      console.log(`[AutoSync] Settings: watchEnabled=${settings.watchEnabled}`)
      if (settings.watchEnabled) {
        console.log(`[AutoSync] Enabled for ${libPath}, starting sync and watch...`)
        const startSync = () => {
          console.log(`[AutoSync] Starting sync for ${libPath}...`)
          syncLibrary
            .run(mainWindow)
            .then((res) => {
              console.log(
                `[AutoSync] Background sync completed. Added: ${res.added}, Removed: ${res.removed}`
              )
              if (res.added > 0) processQueue(mainWindow)
            })
            .catch((err) => {
              console.error(`[AutoSync] Background sync failed:`, err)
            })
        }

        if (mainWindow.webContents.isLoading()) {
          console.log(`[AutoSync] Window loading, waiting for did-finish-load...`)
          mainWindow.webContents.once('did-finish-load', startSync)
        } else {
          startSync()
        }
        watcherService.start(libPath)
      } else {
        console.log(`[AutoSync] Disabled.`)
        watcherService.stop()
      }
    } catch (e) {
      console.error('[AutoSync] Error checking auto sync:', e)
    }
  }

  try {
    const migratedPath = dbManager.tryMigrateLegacy()
    if (migratedPath) {
      globalSettings.addRecentLibrary(migratedPath)
      dbManager.connect(migratedPath)
      checkAutoSync(migratedPath)
    } else {
      const lastLib = globalSettings.lastOpenLibrary
      if (lastLib) {
        try {
          dbManager.connect(lastLib)
          checkAutoSync(lastLib)
        } catch (e) {
          console.error(`Failed to connect to last library: ${lastLib}`, e)
          globalSettings.setLastOpenLibrary(null)
        }
      }
    }
  } catch (e) {
    console.error('Failed to initialize database connection', e)
  }

  // --- Library Management IPC ---

  ipcMain.handle('lib:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null

    const libPath = filePaths[0]
    try {
      dbManager.connect(libPath)
      globalSettings.addRecentLibrary(libPath)
      checkAutoSync(libPath)
      // Reload UI to refresh everything
      mainWindow.reload()
      return libPath
    } catch (e) {
      console.error('Failed to open library', e)
      return null
    }
  })

  ipcMain.handle('lib:switch', async (_, libPath: string) => {
    try {
      dbManager.connect(libPath)
      globalSettings.addRecentLibrary(libPath)
      checkAutoSync(libPath)
      mainWindow.reload()
      return true
    } catch (e) {
      console.error('Failed to switch library', e)
      return false
    }
  })

  ipcMain.handle('lib:getRecent', async () => {
    return globalSettings.recentLibraries
  })

  ipcMain.handle('lib:current', async () => {
    return dbManager.getCurrentLibraryPath()
  })

  // --- Existing handlers (wrapped safely) ---

  // We need to special case handlers that don't need DB or are "safe"

  ipcMain.handle('db:resetProcessed', async () => {
    if (!dbManager.isOpen()) return false
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
    // Phase 1: Registration (Bulk)
    // Note: scan:start in legacy used to take dirPath, which WAS the library path usually.
    // Now library path is fixed. Scanning subdirs is fine.
    // However, usually we scan the ROOT of the library.

    // If dirPath is provided, we scan it.
    console.log(`Starting scan for ${dirPath}`)
    const files = await scanDirectory(dirPath)

    if (!dbManager.isOpen()) throw new Error('No library open')

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
      // Yield to event loop
      await new Promise((resolve) => setImmediate(resolve))
    }

    return await processQueue(mainWindow)
  })

  ipcMain.handle('scan:resume', async () => {
    return await processQueue(mainWindow)
  })

  ipcMain.handle(
    'db:getImages',
    async (_, limit?: number, offset?: number, sortBy?: string, order?: 'asc' | 'desc') => {
      if (!dbManager.isOpen()) return []
      return await getAllImages.all(limit, offset, sortBy, order)
    }
  )

  ipcMain.handle('db:getImageCount', async () => {
    if (!dbManager.isOpen()) return 0
    const { getImageCount } = await import('./db')
    return await getImageCount.get()
  })

  ipcMain.handle('db:getTags', async () => {
    if (!dbManager.isOpen()) return []
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
      if (!dbManager.isOpen()) return []
      const { getImagesByTags } = await import('./db')
      return await getImagesByTags.get({ tagNames, limit, offset, sortBy, order })
    }
  )

  ipcMain.handle('db:getImagesByTagsCount', async (_, tagNames: string[]) => {
    if (!dbManager.isOpen()) return 0
    const { getImagesByTagsCount } = await import('./db')
    return await getImagesByTagsCount.get({ tagNames })
  })

  ipcMain.handle('db:clear', async () => {
    if (!dbManager.isOpen()) return false
    console.log('[IPC] Database clear requested. Stopping background tasks...')

    // 1. Stop components
    watcherService.stop()
    stopQueue()
    const { abortSync } = await import('./db')
    abortSync()

    // 2. Wait a little for loops to yield/break
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 3. Clear database
    await clearDatabase.run()

    // 4. Notify UI to reset progress states
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:complete')
    }

    console.log('[IPC] Database cleared.')
    return true
  })

  ipcMain.handle('db:toggleHiddenTag', async (_, id: number) => {
    return await toggleHiddenTag.run({ id })
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
    if (!dbManager.isOpen()) return { threadCount: 2, language: 'en' }
    const settings = await getSettings.get()
    setTargetThreads(settings.threadCount)
    return settings
  })

  ipcMain.handle('settings:set', async (_, settings: any) => {
    if (settings.threadCount !== undefined) {
      setTargetThreads(settings.threadCount)
    }
    const newSettings = await updateSettings.run(settings)

    // Handle watcher toggle
    if (settings.watchEnabled !== undefined) {
      if (settings.watchEnabled) {
        const libPath = dbManager.getCurrentLibraryPath()
        if (libPath) watcherService.start(libPath)
      } else {
        watcherService.stop()
      }
    }

    return newSettings
  })

  ipcMain.handle('lib:rescan', async () => {
    if (!dbManager.isOpen()) return { success: false }
    const res = await syncLibrary.run(mainWindow)
    await resetProcessed.run()
    processQueue(mainWindow)
    return { success: true, removedCount: res.removed, addedCount: res.added }
  })

  ipcMain.handle('lib:sync', async (_, options?: { skipScan?: boolean; skipCleanup?: boolean }) => {
    if (!dbManager.isOpen()) return { added: 0, removed: 0 }
    if (!dbManager.isOpen()) return { added: 0, removed: 0 }
    const res = await syncLibrary.run(mainWindow, options)
    if (res.added > 0) {
      processQueue(mainWindow)
    }
    return res
  })

  ipcMain.handle('lib:cleanup', async () => {
    if (!dbManager.isOpen()) return { added: 0, removed: 0 }
    return await syncLibrary.run(mainWindow, { skipScan: true, skipCleanup: false })
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

  ipcMain.handle('db:maintenance:fixDates', async () => {
    if (!dbManager.isOpen()) return { count: 0 }
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
    if (!dbManager.isOpen()) return []
    return await getAllTagGroups.get()
  })

  ipcMain.handle('image:getMetadata', async (_, filepath: string) => {
    const { getImageMetadata } = await import('./services/MetadataService')
    return await getImageMetadata(filepath)
  })
}
