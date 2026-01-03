import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join, normalize } from 'path'
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
      const url = new URL(request.url)
      let p = decodeURIComponent(url.pathname)
      let host = decodeURIComponent(url.host)

      let filePath = ''
      if (host && /^[a-zA-Z]:?$/.test(host)) {
        filePath = host + (host.includes(':') ? '' : ':') + (p.startsWith('/') ? '' : '/') + p
      } else {
        filePath = p
      }

      // On Windows, fix common path issues
      if (process.platform === 'win32') {
        if (filePath.startsWith('/') && !filePath.startsWith('//')) {
          filePath = filePath.slice(1)
        }
        filePath = normalize(filePath)
      }

      // Normalize Unicode
      filePath = filePath.normalize('NFC')

      if (!existsSync(filePath)) {
        if (is.dev) console.warn(`[Media] File not found: ${filePath}`)
        return new Response('File not found', { status: 404 })
      }

      return net.fetch(pathToFileURL(filePath).toString())
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
