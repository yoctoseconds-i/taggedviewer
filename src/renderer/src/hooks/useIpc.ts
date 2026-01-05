import { useState, useEffect } from 'react'
import { Image, Tag } from '../types'

export const useIpc = (loadData: () => void) => {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [version, setVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<{
    available: boolean
    info?: any
    checking: boolean
  }>({
    available: false,
    checking: false,
  })

  useEffect(() => {
    // @ts-ignore
    window.electron.ipcRenderer.on(
      'scan:progress',
      (_, data: { total: number; current: number; image?: Image; tags?: Tag[] }) => {
        setScanProgress({ total: data.total, current: data.current })
        setIsScanning(data.current < data.total)
        // Always reload data to show progress (Phase 1: new items, Phase 2: processed status)
        loadData()
      }
    )

    // @ts-ignore
    window.electron.ipcRenderer.on('app:update-available', (_, info) => {
      setUpdateStatus({ available: true, info, checking: false })
    })

    // @ts-ignore
    window.electron.ipcRenderer.on('app:update-not-available', () => {
      setUpdateStatus({ available: false, checking: false })
    })

    const fetchVersion = async () => {
      // @ts-ignore
      const v = await window.electron.ipcRenderer.invoke('app:getVersion')
      setVersion(v)
    }
    fetchVersion()

    return () => {
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('scan:progress')
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('app:update-available')
      // @ts-ignore
      window.electron.ipcRenderer.removeAllListeners('app:update-not-available')
    }
  }, [loadData])

  const checkForUpdates = async () => {
    setUpdateStatus((s) => ({ ...s, checking: true }))
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('app:checkForUpdates')
  }

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
    loadData()
  }

  return {
    isScanning,
    setIsScanning,
    scanProgress,
    openFolder,
    toggleFavorite,
    showItemInFolder,
    clearLibrary,
    rescanLibrary,
    version,
    updateStatus,
    checkForUpdates,
  }
}
