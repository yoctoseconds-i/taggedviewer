import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIPC } from './ipc'
import { pathToFileURL } from 'url'
import { existsSync } from 'fs'
import { deleteImageByPath } from './db'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  setupIPC(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register privileged schemes (must be done before app is ready)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true },
  },
])

app.whenReady().then(() => {
  // Register 'media' protocol to handle local file access
  protocol.handle('media', async (request) => {
    try {
      const urlObj = new URL(request.url)
      // urlObj.pathname will be like "/E:/path/to/file.png"
      let decodePath = decodeURIComponent(urlObj.pathname)

      // Remove leading slash for Windows drive paths (e.g. /C:/... -> C:/...)
      if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decodePath)) {
        decodePath = decodePath.slice(1)
      }

      // Lazy Cleanup Check
      if (!existsSync(decodePath)) {
        if (is.dev) console.log(`[Media] File missing: ${decodePath}. Cleaning up...`)
        const result = await deleteImageByPath.run({ filepath: decodePath })
        if (result.success) {
          // Notify renderer to remove from UI
          const windows = BrowserWindow.getAllWindows()
          if (windows.length > 0) {
            windows[0].webContents.send('image:deleted', result.id)
          }
        }
        return new Response('File not found', { status: 404 })
      }

      if (is.dev) console.log(`[Media] Serving: ${decodePath}`)

      const fileUrl = pathToFileURL(decodePath).toString()
      return net.fetch(fileUrl)
    } catch (e) {
      console.error('Media protocol error:', request.url, e)
      return new Response('Error loading media', { status: 400 })
    }
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
