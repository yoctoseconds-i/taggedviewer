import { Image, Tag } from '../types'
import { useState, useEffect, useRef, useCallback } from 'react'

export interface UpdateStatus {
  available: boolean
  version?: string
  releaseName?: string
  releaseNotes?: string
  releaseDate?: string
  htmlUrl?: string
  info?: any
  checking: boolean
  dismissed?: boolean
}

export const useIpc = (loadData: () => void) => {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [version, setVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    available: false,
    checking: false,
    dismissed: false,
  })
  const lastReloadRef = useRef<number>(0)

  const checkForUpdates = async () => {
    setUpdateStatus((s) => ({ ...s, checking: true }))
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('app:checkForUpdates')
      if (result) {
        setUpdateStatus({
          available: !!result.available,
          version: result.version,
          releaseName: result.releaseName,
          releaseNotes: result.releaseNotes,
          releaseDate: result.releaseDate,
          htmlUrl: result.htmlUrl || 'https://github.com/yoctoseconds-i/taggedviewer/releases',
          info: result,
          checking: false,
          dismissed: false,
        })
      } else {
        setUpdateStatus((s) => ({ ...s, checking: false }))
      }
    } catch {
      setUpdateStatus((s) => ({ ...s, checking: false }))
    }
  }

  const dismissUpdate = () => {
    setUpdateStatus((s) => ({ ...s, dismissed: true }))
  }

  useEffect(() => {
    // @ts-ignore
    window.electron.ipcRenderer.on(
      'scan:progress',
      (_, data: { total: number; current: number; image?: Image; tags?: Tag[] }) => {
        setScanProgress({ total: data.total, current: data.current })
        setIsScanning(data.current < data.total)

        // Throttle data reload during scan
        const now = Date.now()
        if (now - lastReloadRef.current > 500 || data.current === data.total) {
          lastReloadRef.current = now
          loadData()
        }
      }
    )

    // @ts-ignore
    window.electron.ipcRenderer.on('scan:start', () => {
      setIsScanning(true)
    })

    // @ts-ignore
    window.electron.ipcRenderer.on('scan:complete', () => {
      setIsScanning(false)
      loadData()
    })

    // @ts-ignore
    window.electron.ipcRenderer.on('app:update-available', (_, info) => {
      setUpdateStatus({
        available: true,
        version: info?.version,
        releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : undefined,
        info,
        checking: false,
        dismissed: false,
      })
    })

    // @ts-ignore
    window.electron.ipcRenderer.on('app:update-not-available', () => {
      setUpdateStatus({ available: false, checking: false, dismissed: false })
    })

    const init = async () => {
      // @ts-ignore
      const v = await window.electron.ipcRenderer.invoke('app:getVersion')
      setVersion(v)
      // Check updates on startup
      checkForUpdates()
    }
    init()

    return () => {
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('scan:progress')
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('app:update-available')
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('app:update-not-available')
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('scan:start')
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('scan:complete')
    }
  }, [loadData])

  const openFolder = async () => {
    // @ts-ignore
    const dir = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
    if (dir) {
      setIsScanning(true)
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('scan:start', dir)
      setIsScanning(false)
      loadData()
    }
  }

  const toggleFavorite = async (id: number) => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('db:toggleFavoriteTag', id)
    loadData()
  }

  const toggleHidden = async (id: number) => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('db:toggleHiddenTag', id)
    loadData()
  }

  const showItemInFolder = async (filepath: string) => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('shell:showItemInFolder', filepath)
  }

  const clearLibrary = async () => {
    if (
      !confirm(
        'ライブラリ内のすべての画像とタグ情報を完全に削除しますか？\nこの操作は取り消せません。'
      )
    )
      return
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('db:clear')
    loadData()
  }

  const rescanLibrary = async () => {
    setIsScanning(true)
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('lib:rescan')
    setIsScanning(false)
    loadData()
  }

  const syncLibrary = async () => {
    setIsScanning(true)
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('lib:sync')
    setIsScanning(false)
    loadData()
  }

  const openLibrary = useCallback(async () => {
    // @ts-ignore
    return await window.electron.ipcRenderer.invoke('lib:open')
  }, [])

  const switchLibrary = useCallback(async (path: string) => {
    // @ts-ignore
    return await window.electron.ipcRenderer.invoke('lib:switch', path)
  }, [])

  const getRecentLibraries = useCallback(async () => {
    // @ts-ignore
    return (await window.electron.ipcRenderer.invoke('lib:getRecent')) as string[]
  }, [])

  const getCurrentLibrary = useCallback(async () => {
    // @ts-ignore
    return (await window.electron.ipcRenderer.invoke('lib:current')) as string | null
  }, [])

  return {
    isScanning,
    setIsScanning,
    scanProgress,
    openFolder,
    toggleFavorite,
    toggleHidden,
    showItemInFolder,
    clearLibrary,
    checkForUpdates,

    syncLibrary,
    version,
    updateStatus,
    dismissUpdate,
    rescanLibrary,
    openLibrary,
    switchLibrary,
    getRecentLibraries,
    getCurrentLibrary,
  }
}
