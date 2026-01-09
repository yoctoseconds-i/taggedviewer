import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FolderOpen } from 'lucide-react'
import type { Image, Tag, Settings, TagGroup } from './types'
import { useIpc } from './hooks/useIpc'
import { useTranslation } from 'react-i18next'

// Components
import { SettingsModal } from './components/SettingsModal/SettingsModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TagGroupModal } from './components/TagGroupModal/TagGroupModal'
import { ImageGrid } from './components/Gallery/ImageGrid'
import { ImageViewer } from './components/Gallery/ImageViewer'
import { ScanningProgress } from './components/Gallery/ScanningProgress'
import { SelectedTagsBar } from './components/Gallery/SelectedTagsBar'
import { SortControl, SortKey, SortOrder } from './components/Gallery/SortControl'

function App(): JSX.Element {
  const { t, i18n } = useTranslation()
  const [images, setImages] = useState<Image[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [selectedImageTags, setSelectedImageTags] = useState<Tag[]>([])
  const [tagSort, setTagSort] = useState<'name' | 'count'>('count')
  const [tagSearchTerm, setTagSearchTerm] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<Settings>({ threadCount: 2 })

  // Tag Groups
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([])
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupToEdit, setGroupToEdit] = useState<TagGroup | null>(null)

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)

  const loadTagGroups = useCallback(async () => {
    // @ts-ignore
    const groups = await window.electron.ipcRenderer.invoke('db:getTagGroups')
    setTagGroups(groups)
  }, [])

  const loadData = useCallback(
    async (isInitial = false, offsetOverride?: number) => {
      // Determine if we should block.
      // If it's a "load more" (not initial), block if already loading.
      // If it's initial, we allow it (effectively canceling the visual effect of previous loads by replacing data)
      // Ideally we would cancel the previous promise, but for now we just allow the new one to run.
      if (loadingRef.current && !isInitial) return

      loadingRef.current = true

      try {
        const limit = 100
        const offset = offsetOverride ?? 0

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
          imgs = await window.electron.ipcRenderer.invoke(
            'db:getImages',
            limit,
            offset,
            sortKey,
            sortOrder
          )
        }

        if (isInitial) {
          setImages(imgs)
          let count = 0
          if (selectedTags.length > 0) {
            // @ts-ignore
            count = await window.electron.ipcRenderer.invoke(
              'db:getImagesByTagsCount',
              selectedTags
            )
          } else {
            // @ts-ignore
            count = await window.electron.ipcRenderer.invoke('db:getImageCount')
          }
          setHasMore(imgs.length < count)
        } else {
          setImages((prev) => [...prev, ...imgs])
          setHasMore(imgs.length === limit)
        }

        // @ts-ignore
        const tgs = await window.electron.ipcRenderer.invoke('db:getTags')
        setTags(tgs)
      } finally {
        loadingRef.current = false
      }
    },
    [selectedTags, sortKey, sortOrder]
  )

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
  } = useIpc(async () => loadData(true, 0))

  useEffect(() => {
    const init = async () => {
      // @ts-ignore
      const savedSettings = await window.electron.ipcRenderer.invoke('settings:get')
      if (savedSettings) {
        setSettings(savedSettings)
        if (savedSettings.language) {
          i18n.changeLanguage(savedSettings.language)
        }
      }

      setIsScanning(true)
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('scan:resume')
      setIsScanning(false)
      loadData(true, 0)
      loadTagGroups()
    }
    init()
  }, [setIsScanning, loadData, loadTagGroups, i18n])

  useEffect(() => {
    setImages([])
    loadingRef.current = false // Force reset loading state to ensure new fetch runs
    loadData(true, 0)
  }, [selectedTags, sortKey, sortOrder, loadData])

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

  const handleUpdateLanguage = async (lang: string) => {
    const newSettings = { ...settings, language: lang }
    setSettings(newSettings)
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('settings:set', newSettings)
  }

  const handleTagClick = (tagName: string | null) => {
    if (!tagName) {
      setSelectedTags([])
      return
    }

    setSelectedTags((prev) => {
      if (prev.includes(tagName)) {
        return prev.filter((t) => t !== tagName)
      }
      return [...prev, tagName]
    })
    setSelectedImageIndex(null)
  }

  const handleGroupClick = (group: TagGroup) => {
    // Collect all tag names from the group
    const tagNames = group.tags.map((t) => t.name)
    setSelectedTags(tagNames)
    setSelectedImageIndex(null)
  }

  const handleCreateGroup = () => {
    setGroupToEdit(null)
    setIsGroupModalOpen(true)
  }

  const handleEditGroup = (group: TagGroup) => {
    setGroupToEdit(group)
    setIsGroupModalOpen(true)
  }

  const handleSaveGroup = async (name: string, tagIds: number[]) => {
    if (groupToEdit) {
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('db:updateTagGroup', {
        id: groupToEdit.id,
        name,
        tagIds,
      })
    } else {
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('db:createTagGroup', {
        name,
        tagIds,
      })
    }
    loadTagGroups()
  }

  const handleDeleteGroup = async (id: number) => {
    // @ts-ignore
    await window.electron.ipcRenderer.invoke('db:deleteTagGroup', { id })
    loadTagGroups()
  }

  return (
    <div className="flex h-screen bg-black text-gray-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar
        tags={filteredTags}
        activeTags={selectedTags}
        onTagClick={handleTagClick}
        onToggleSort={() => setTagSort((prev) => (prev === 'name' ? 'count' : 'name'))}
        onOpenSettings={() => setShowSettings(true)}
        tagSearchTerm={tagSearchTerm}
        onSearchChange={setTagSearchTerm}
        onToggleFavorite={toggleFavorite}
        tagGroups={tagGroups}
        onGroupClick={handleGroupClick}
        onCreateGroup={handleCreateGroup}
        onEditGroup={handleEditGroup}
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
              loadMore={() => loadData(false, images.length)}
              hasMore={hasMore}
            />
          ) : !isScanning ? (
            <div className="flex-1 h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <FolderOpen className="w-16 h-16 text-gray-800" />
              <div className="text-center">
                <p className="text-sm font-bold text-gray-400">{t('app.emptyLibrary')}</p>
                <button
                  onClick={openFolder}
                  className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                >
                  {t('app.selectFolder')}
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
        onUpdateLanguage={handleUpdateLanguage}
        onRescan={rescanLibrary}
        onClear={clearLibrary}
        version={version}
        updateStatus={updateStatus}
        onCheckForUpdates={checkForUpdates}
      />

      <TagGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        groupToEdit={groupToEdit}
        availableTags={tags}
        initialTags={
          groupToEdit ? groupToEdit.tags : tags.filter((t) => selectedTags.includes(t.name))
        }
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
      />
    </div>
  )
}

export default App
