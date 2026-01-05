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
import { SelectedTagsBar } from './components/Gallery/SelectedTagsBar'
import { SortControl, SortKey, SortOrder } from './components/Gallery/SortControl'

function App(): JSX.Element {
  const [images, setImages] = useState<Image[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [selectedImageTags, setSelectedImageTags] = useState<Tag[]>([])
  const [tagSort, setTagSort] = useState<'name' | 'count'>('count')
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>({ threadCount: 2 })

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const loadData = useCallback(async (isInitial = false) => {
    // Determine if we should block.
    // If it's a "load more" (not initial), block if already loading.
    // If it's initial, we allow it (effectively canceling the visual effect of previous loads by replacing data)
    // Ideally we would cancel the previous promise, but for now we just allow the new one to run.
    if (loading && !isInitial) return
    setLoading(true)

    try {
      const limit = 100
      const offset = isInitial ? 0 : images.length

      let imgs // ...
      if (selectedTags.length > 0) {
        // @ts-ignore
        imgs = await window.electron.ipcRenderer.invoke(
          'db:getImagesByTags',
          selectedTags,
          limit,
          offset,
          sortKey,
          sortOrder
        )
      } else {
        // @ts-ignore
        imgs = await window.electron.ipcRenderer.invoke('db:getImages', limit, offset, sortKey, sortOrder)
      }

      if (isInitial) {
        setImages(imgs)
        let count = 0
        if (selectedTags.length > 0) {
          // @ts-ignore
          count = await window.electron.ipcRenderer.invoke('db:getImagesByTagsCount', selectedTags)
        } else {
          // @ts-ignore
          count = await window.electron.ipcRenderer.invoke('db:getImageCount')
        }
        setTotalCount(count)
        setHasMore(imgs.length < count)
      } else {
        setImages((prev) => [...prev, ...imgs])
        setHasMore(imgs.length === limit)
      }

      // @ts-ignore
      const tgs = await window.electron.ipcRenderer.invoke('db:getTags')
      setTags(tgs)
    } finally {
      setLoading(false)
    }
  }, [selectedTags, images.length, loading, sortKey, sortOrder])

  const {
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
  } = useIpc(async () => loadData(true))

  useEffect(() => {
    const init = async () => {
      // @ts-ignore
      const savedSettings = await window.electron.ipcRenderer.invoke('settings:get')
      if (savedSettings) setSettings(savedSettings)

      setIsScanning(true)
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('scan:resume')
      setIsScanning(false)
      loadData(true)
    }
    init()
  }, [setIsScanning])

  useEffect(() => {
    setImages([])
    setTotalCount(0)
    setLoading(false) // Force reset loading state to ensure new fetch runs
    loadData(true)
  }, [selectedTags, sortKey, sortOrder])

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
    if (!tagName) {
      setSelectedTags([])
      return
    }

    setSelectedTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName)
      }
      return [...prev, tagName]
    })
    setSelectedImageIndex(null)
  }

  return (
    <div className="flex h-screen bg-black text-gray-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar
        tags={filteredTags}
        activeTags={selectedTags}
        onTagClick={handleTagClick}
        tagSort={tagSort}
        onToggleSort={() => setTagSort((prev) => (prev === 'name' ? 'count' : 'name'))}
        onOpenSettings={() => setShowSettings(true)}
        tagSearchTerm={tagSearchTerm}
        onSearchChange={setTagSearchTerm}
        onToggleFavorite={toggleFavorite}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-gray-950/50 relative">
        <div className="flex items-center justify-between p-2 pb-0">
          <SelectedTagsBar
            selectedTags={selectedTags}
            onRemoveTag={(t) => handleTagClick(t)}
            onClearAll={() => setSelectedTags([])}
          />
          <div className="ml-auto px-2">
            <SortControl
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSortChange={(k, o) => {
                setSortKey(k)
                setSortOrder(o)
              }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {images.length > 0 ? (
            <ImageGrid
              images={images}
              onImageClick={setSelectedImageIndex}
              loadMore={() => loadData(false)}
              hasMore={hasMore}
            />
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
              setSelectedTags([name])
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
        version={version}
        updateStatus={updateStatus}
        onCheckForUpdates={checkForUpdates}
      />
    </div>
  )
}

export default App
