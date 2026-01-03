import { useState, useEffect, useMemo, useCallback } from 'react'
import { FolderOpen } from 'lucide-react'
import type { Image, Tag, Settings } from './types'
import { useIpc } from './hooks/useIpc'

// Components
import { SettingsModal } from './components/SettingsModal/SettingsModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ImageGrid } from './components/Gallery/ImageGrid'
import { ImageViewer } from './components/Gallery/ImageViewer'
import { ScanningProgress } from './components/Gallery/ScanningProgress'

function App(): JSX.Element {
  const [images, setImages] = useState<Image[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [selectedImageTags, setSelectedImageTags] = useState<Tag[]>([])
  const [tagSort, setTagSort] = useState<'name' | 'count'>('count')
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>({ threadCount: 2 })

  const loadData = useCallback(async () => {
    // @ts-ignore
    const imgs = await window.electron.ipcRenderer.invoke(
      activeTag ? 'db:getImagesByTag' : 'db:getImages',
      activeTag
    )
    // @ts-ignore
    const tgs = await window.electron.ipcRenderer.invoke('db:getTags')
    setImages(imgs)
    setTags(tgs)
  }, [activeTag])

  const {
    isScanning,
    setIsScanning,
    scanProgress,
    openFolder,
    toggleFavorite,
    showItemInFolder,
    clearLibrary,
    rescanLibrary,
  } = useIpc(loadData)

  useEffect(() => {
    const init = async () => {
      // @ts-ignore
      const savedSettings = await window.electron.ipcRenderer.invoke('settings:get')
      if (savedSettings) setSettings(savedSettings)

      setIsScanning(true)
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('scan:resume')
      setIsScanning(false)
      loadData()
    }
    init()
  }, [loadData, setIsScanning])

  useEffect(() => {
    loadData()
  }, [activeTag, loadData])

  useEffect(() => {
    if (selectedImageIndex !== null) {
      const loadTags = async () => {
        // @ts-ignore
        const t = await window.electron.ipcRenderer.invoke(
          'db:getTagsForImage',
          images[selectedImageIndex].id
        )
        setSelectedImageTags(t)
      }
      loadTags()
    }
  }, [selectedImageIndex, images])

  const filteredTags = useMemo(() => {
    return tags
      .filter((t) => t.name.toLowerCase().includes(tagSearchTerm.toLowerCase()))
      .sort((a, b) => {
        if (tagSort === 'name') return a.name.localeCompare(b.name)
        return (b.count || 0) - (a.count || 0)
      })
  }, [tags, tagSort, tagSearchTerm])

  const handleUpdateThreadCount = async (count: number) => {
    const newSettings = { ...settings, threadCount: count }
    setSettings(newSettings)
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('settings:set', newSettings)
  }

  const handleTagClick = (tagName: string | null) => {
    setActiveTag(tagName)
    setSelectedImageIndex(null)
  }

  return (
    <div className="flex h-screen bg-black text-gray-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar
        tags={filteredTags}
        activeTag={activeTag}
        onTagClick={handleTagClick}
        tagSort={tagSort}
        onToggleSort={() => setTagSort((prev) => (prev === 'name' ? 'count' : 'name'))}
        onOpenSettings={() => setShowSettings(true)}
        tagSearchTerm={tagSearchTerm}
        onSearchChange={setTagSearchTerm}
        onToggleFavorite={toggleFavorite}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-gray-950/50 relative">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {images.length > 0 ? (
            <ImageGrid images={images} onImageClick={setSelectedImageIndex} />
          ) : !isScanning ? (
            <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <FolderOpen className="w-16 h-16 text-gray-800" />
              <div className="text-center">
                <p className="text-sm font-bold text-gray-400">Your library is empty</p>
                <button
                  onClick={openFolder}
                  className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                >
                  Select Folder to Scan
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {isScanning && (
          <ScanningProgress current={scanProgress.current} total={scanProgress.total} />
        )}

        {selectedImageIndex !== null && images[selectedImageIndex] && (
          <ImageViewer
            image={images[selectedImageIndex]}
            tags={selectedImageTags}
            onClose={() => setSelectedImageIndex(null)}
            onOpenFolder={showItemInFolder}
            onToggleFavorite={toggleFavorite}
            onTagClick={(name) => {
              setActiveTag(name)
              setSelectedImageIndex(null)
            }}
          />
        )}
      </main>

      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateThreadCount={handleUpdateThreadCount}
        onRescan={rescanLibrary}
        onClear={clearLibrary}
      />
    </div>
  )
}

export default App
