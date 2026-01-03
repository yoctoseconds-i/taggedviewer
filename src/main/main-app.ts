import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join, normalize } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIPC } from './ipc'
import { pathToFileURL } from 'url'
import { existsSync } from 'fs'
import { autoUpdater } from 'electron-updater'

export function startMainApp() {
  // Configure autoUpdater
  autoUpdater.autoDownload = false

  function createWindow(): void {
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

    autoUpdater.on('update-available', (info) => {
      mainWindow.webContents.send('app:update-available', info)
    })

    autoUpdater.on('update-not-available', () => {
      mainWindow.webContents.send('app:update-not-available')
    })

    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify()
    }

    mainWindow.on('ready-to-show', () => {
      mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true },
    },
  ])

  app.whenReady().then(() => {
    protocol.handle('media', async (request) => {
      try {
        const url = new URL(request.url)
        let p = decodeURIComponent(url.pathname)
        let host = decodeURIComponent(url.host)
        const size = url.searchParams.get('size')

        let filePath = ''
        if (host && /^[a-zA-Z]:?$/.test(host)) {
          filePath = host + (host.includes(':') ? '' : ':') + (p.startsWith('/') ? '' : '/') + p
        } else {
          filePath = p
        }

        if (process.platform === 'win32') {
          if (filePath.startsWith('/') && !filePath.startsWith('//')) {
            filePath = filePath.slice(1)
          }
          filePath = normalize(filePath)
        }
        filePath = filePath.normalize('NFC')

        if (!existsSync(filePath)) {
          return new Response('File not found', { status: 404 })
        }

        if (size === 'thumb') {
          const sharp = require('sharp')
          const buffer = await sharp(filePath)
            .resize(256, 256, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 80 })
            .toBuffer()

          return new Response(buffer, {
            headers: { 'Content-Type': 'image/jpeg' },
          })
        }

        return net.fetch(pathToFileURL(filePath).toString())
      } catch (e) {
        console.error('[Media Protocol Error]', e)
        return new Response('Error loading media', { status: 400 })
      }
    })

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
}
