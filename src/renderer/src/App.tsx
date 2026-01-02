import { useState, useEffect, useMemo } from 'react'
import { Hash, FolderOpen, Image as ImageIcon, Loader2, Settings, Trash2, ArrowUpDown, Star, Search, X, RefreshCw, AlertTriangle } from 'lucide-react'
import type { Image, Tag } from './types'

function App(): JSX.Element {
    const [images, setImages] = useState<Image[]>([])
    const [tags, setTags] = useState<Tag[]>([])
    const [activeTag, setActiveTag] = useState<string | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
    const [selectedImageTags, setSelectedImageTags] = useState<Tag[]>([])
    const [navVisible, setNavVisible] = useState(true)
    const [uiVisible, setUiVisible] = useState(false)
    const [showDebugMenu, setShowDebugMenu] = useState(false)
    const [tagSort, setTagSort] = useState<'name' | 'count'>('count')
    const [tagSearchTerm, setTagSearchTerm] = useState('')
    const [showSettings, setShowSettings] = useState(false)
    const [settings, setSettings] = useState<{ threadCount: number }>({ threadCount: 2 })

    // Unified data loading
    const loadData = async () => {
        if (activeTag) {
            // @ts-ignore
            const taggedImages = await window.electron.ipcRenderer.invoke('db:getImagesByTag', activeTag)
            setImages(taggedImages)
        } else {
            // @ts-ignore
            const allImages = await window.electron.ipcRenderer.invoke('db:getImages')
            setImages(allImages)
        }
        // Always refresh tags as new ones might appear
        // @ts-ignore
        const allTags = await window.electron.ipcRenderer.invoke('db:getTags')
        setTags(allTags)
    }

    const loadSelectedImageTags = async (index: number | null) => {
        if (index === null || !images[index]) {
            setSelectedImageTags([])
            return
        }
        // @ts-ignore
        const tags = await window.electron.ipcRenderer.invoke('db:getTagsForImage', images[index].id)
        setSelectedImageTags(tags)
    }

    useEffect(() => {
        loadSelectedImageTags(selectedImageIndex)
        if (selectedImageIndex !== null) {
            setUiVisible(false) // Reset UI visibility when changing images
        }
    }, [selectedImageIndex, images])

    // Controls auto-hide logic (Nav arrows only)
    useEffect(() => {
        if (selectedImageIndex === null) return

        let timer: NodeJS.Timeout
        const handleMouseMove = () => {
            setNavVisible(true)
            clearTimeout(timer)
            timer = setTimeout(() => setNavVisible(false), 5000)
        }

        window.addEventListener('mousemove', handleMouseMove)
        handleMouseMove() // Initial trigger

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            clearTimeout(timer)
        }
    }, [selectedImageIndex])

    const handleToggleFavorite = async (e: React.MouseEvent, tagId: number) => {
        e.stopPropagation()
        // @ts-ignore
        const updatedTag = await window.electron.ipcRenderer.invoke('db:toggleFavoriteTag', tagId)
        if (updatedTag) {
            setTags(prev => prev.map(t => t.id === tagId ? { ...t, is_favorite: updatedTag.is_favorite } : t))
            setSelectedImageTags(prev => prev.map(t => t.id === tagId ? { ...t, is_favorite: updatedTag.is_favorite } : t))
        }
    }

    const handleOpenInExplorer = async (e: React.MouseEvent, filepath: string) => {
        e.stopPropagation()
        // @ts-ignore
        await window.electron.ipcRenderer.invoke('shell:showItemInFolder', filepath)
    }

    const handleClearLibrary = async () => {
        if (confirm('Are you sure you want to delete all library data? This cannot be undone.')) {
            // @ts-ignore
            await window.electron.ipcRenderer.invoke('db:clear')
            setImages([])
            setTags([])
            setActiveTag(null)
            loadData()
            setShowDebugMenu(false)
        }
    }

    const sortedTags = useMemo(() => {
        return [...tags].sort((a, b) => {
            if (tagSort === 'count') {
                return (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name)
            }
            return a.name.localeCompare(b.name)
        })
    }, [tags, tagSort])

    const favoriteTags = useMemo(() => {
        return sortedTags.filter(t => t.is_favorite)
    }, [sortedTags])

    const searchableTags = useMemo(() => {
        if (!tagSearchTerm.trim()) return sortedTags
        const term = tagSearchTerm.toLowerCase()
        return sortedTags.filter(t => t.name.toLowerCase().includes(term))
    }, [sortedTags, tagSearchTerm])

    const favoriteSearchableTags = useMemo(() => {
        return searchableTags.filter(t => t.is_favorite)
    }, [searchableTags])

    useEffect(() => {
        loadData()
    }, [activeTag]) // Reload when activeTag changes

    useEffect(() => {
        // @ts-ignore
        const removeScanListener = window.electron.ipcRenderer.on('scan:progress', (_event, payload) => {
            setScanProgress({ current: payload.current, total: payload.total })

            // Update images (prepend to "All Photos")
            if (payload.image && !activeTag) {
                setImages(prev => {
                    if (prev.find(i => i.id === payload.image.id)) return prev
                    return [payload.image, ...prev]
                })
            }

            // Update tags (increment count or add new)
            if (payload.tags && payload.tags.length > 0) {
                setTags(prevTags => {
                    let newTags = [...prevTags]
                    const tagsToAdd: Tag[] = []

                    payload.tags.forEach((newTag: Tag) => {
                        const existingIndex = newTags.findIndex(t => t.name === newTag.name)
                        if (existingIndex >= 0) {
                            // Increment existing
                            const currentCount = newTags[existingIndex].count || 0
                            newTags[existingIndex] = { ...newTags[existingIndex], count: currentCount + 1 }
                        } else {
                            // Add new tag with count 1
                            tagsToAdd.push({ ...newTag, count: 1 })
                        }
                    })

                    return [...newTags, ...tagsToAdd]
                })
            }
        })

        // @ts-ignore
        const removeDeleteListener = window.electron.ipcRenderer.on('image:deleted', (_event, deletedId: number) => {
            // Remove from local state
            setImages(prev => prev.filter(img => img.id !== deletedId))
            // Also close lightbox if the deleted image was selected? 
            // That requires accessing selectedImageIndex which is not in this effect's dependency.
            // But 'images' is updated, so the lightbox component using images[selectedImageIndex] might break if index out of bounds.
            // However, React renders might handle it if we are careful. 
            // Better to just update the list for now.
            console.log('Removed deleted image from view:', deletedId)
        })

        return () => {
            removeScanListener()
            removeDeleteListener()
        }
    }, [activeTag])

    // Keyboard navigation for lightbox
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedImageIndex === null) return
            if (e.key === 'Escape') setSelectedImageIndex(null)
            if (e.key === 'ArrowRight') {
                setSelectedImageIndex(prev => (prev !== null && prev < images.length - 1 ? prev + 1 : prev))
            }
            if (e.key === 'ArrowLeft') {
                setSelectedImageIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev))
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedImageIndex, images.length])

    // When scanning finishes, we should reload data
    useEffect(() => {
        if (!isScanning) {
            loadData()
        }
    }, [isScanning])

    // Resume scanning on mount and load settings
    useEffect(() => {
        const init = async () => {
            // @ts-ignore
            const savedSettings = await window.electron.ipcRenderer.invoke('settings:get')
            if (savedSettings) setSettings(savedSettings)

            setIsScanning(true)
            // @ts-ignore
            await window.electron.ipcRenderer.invoke('scan:resume')
            setIsScanning(false)
        }
        init()
    }, [])

    const handleUpdateThreadCount = async (count: number) => {
        const newSettings = { ...settings, threadCount: count }
        setSettings(newSettings)
        // @ts-ignore
        await window.electron.ipcRenderer.invoke('settings:set', newSettings)
    }

    const handleOpenFolder = async () => {
        // @ts-ignore
        const dir = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
        if (dir) {
            setIsScanning(true)
            setImages([])
            setScanProgress({ current: 0, total: 0 })
            // @ts-ignore
            await window.electron.ipcRenderer.invoke('scan:start', dir)
            setIsScanning(false)
        }
    }

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500/30">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col relative z-20">
                <div className="p-4 flex items-center justify-between border-b border-gray-800">
                    <div className="flex items-center space-x-2">
                        <div className="bg-indigo-500 rounded p-1 shadow-lg shadow-indigo-500/20">
                            <ImageIcon className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">TaggedViewer</h1>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => setTagSort(prev => prev === 'name' ? 'count' : 'name')}
                            className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                            title={tagSort === 'name' ? 'Sort by Count' : 'Sort by Name'}
                        >
                            <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    <button
                        onClick={handleOpenFolder}
                        disabled={isScanning}
                        className="w-full group flex justify-center items-center space-x-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2 rounded-md font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                        <span>{isScanning ? 'Scanning...' : 'Open Folder'}</span>
                    </button>

                    {isScanning && (
                        <div className="mt-4 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Scanning</span>
                                <span>{scanProgress.current} / {scanProgress.total}</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-300 ease-out relative overflow-hidden"
                                    style={{ width: `${(scanProgress.current / Math.max(scanProgress.total, 1)) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite] w-full h-full" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-4 pb-2">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search tags..."
                            value={tagSearchTerm}
                            onChange={(e) => setTagSearchTerm(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-600"
                        />
                        {tagSearchTerm && (
                            <button
                                onClick={() => setTagSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-800 rounded-md text-gray-500 hover:text-white transition-all"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-800">
                    <div className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">
                        Library
                    </div>
                    <button
                        onClick={() => setActiveTag(null)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTag === null
                            ? 'bg-gray-800 text-white shadow-md shadow-black/20'
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 hover:pl-4'
                            }`}
                    >
                        <ImageIcon className="w-4 h-4" />
                        <span>All Photos</span>
                    </button>

                    {favoriteSearchableTags.length > 0 && (
                        <>
                            <div className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6 flex items-center gap-2">
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                Favorites
                            </div>
                            <div className="space-y-0.5">
                                {favoriteSearchableTags.map(tag => (
                                    <button
                                        key={`fav-${tag.id}`}
                                        onClick={() => setActiveTag(tag.name)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${activeTag === tag.name
                                            ? 'bg-yellow-500/10 text-yellow-500 shadow-sm border border-yellow-500/20'
                                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 hover:pl-4'
                                            }`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Hash className="w-4 h-4 opacity-50" />
                                            <span>{tag.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {tag.count !== undefined && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTag === tag.name ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-800 text-gray-500'}`}>
                                                    {tag.count}
                                                </span>
                                            )}
                                            <button
                                                onClick={(e) => handleToggleFavorite(e, tag.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                                            >
                                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                            </button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6">
                        Tags
                    </div>
                    <div className="space-y-0.5">
                        {searchableTags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => setActiveTag(tag.name)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${activeTag === tag.name
                                    ? 'bg-indigo-500/10 text-indigo-400 shadow-sm border border-indigo-500/20'
                                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 hover:pl-4'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <Hash className="w-4 h-4" />
                                    <span>{tag.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {tag.count !== undefined && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTag === tag.name ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-500 group-hover:bg-gray-700'}`}>
                                            {tag.count}
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => handleToggleFavorite(e, tag.id)}
                                        className={`p-1 hover:bg-gray-700 rounded transition-all ${tag.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <Star className={`w-3.5 h-3.5 ${tag.is_favorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-500'}`} />
                                    </button>
                                </div>
                            </button>
                        ))}
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-gray-950 relative">
                <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md z-10 sticky top-0">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-xl font-semibold text-white tracking-tight">
                            {activeTag ? (
                                <span className="flex items-center gap-2">
                                    <span className="text-gray-500">#</span>
                                    {activeTag}
                                </span>
                            ) : 'All Images'}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 text-xs font-medium text-gray-400 border border-gray-700">
                            {images.length}
                        </span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 pb-20">
                        {images.map((image, index) => (
                            <div
                                key={image.id}
                                onClick={() => setSelectedImageIndex(index)}
                                className="group relative aspect-[3/4] bg-gray-900 rounded-xl overflow-hidden shadow-xl hover:shadow-indigo-500/20 transition-all duration-500 hover:-translate-y-1 ring-1 ring-white/5 hover:ring-indigo-500/50 cursor-pointer animate-in fade-in zoom-in-95 fill-mode-both"
                                style={{ animationDelay: `${Math.min(index * 50, 1000)}ms` }}
                            >
                                <img
                                    src={`media://local/${image.filepath.replace(/\\/g, '/')}`}
                                    alt=""
                                    loading="lazy"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <p className="text-xs font-medium text-gray-200 truncate">{image.filepath.split('\\').pop()}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">{new Date(image.scanned_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}

                        {images.length === 0 && !isScanning && (
                            <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-500 animate-in fade-in duration-500">
                                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-6 ring-1 ring-gray-800">
                                    <ImageIcon className="w-10 h-10 opacity-50" />
                                </div>
                                <p className="text-lg font-medium text-gray-400">No images found</p>
                                <p className="text-sm text-gray-600 mt-2">Open a folder to start scanning your collection.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lightbox */}
                {selectedImageIndex !== null && (
                    <div
                        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-300 select-none"
                        onClick={() => setUiVisible(!uiVisible)}
                    >
                        {/* Top controls (Close Button) - Toggled via click */}
                        <div
                            className={`absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-6 transition-all duration-500 z-[60] ${uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex flex-col">
                                <span className="text-white font-semibold text-base truncate max-w-md">
                                    {images[selectedImageIndex].filepath.split('\\').pop()}
                                </span>
                                <span className="text-gray-400 text-xs uppercase tracking-widest mt-1">
                                    IMAGE {selectedImageIndex + 1} OF {images.length}
                                </span>
                            </div>
                            <button
                                className="p-4 text-white/70 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/10 bg-black/20 backdrop-blur-md"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedImageIndex(null)
                                }}
                            >
                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Navigation Arrows - Toggled via Mouse Movement */}
                        <div className={`contents transition-opacity duration-700 ${navVisible ? 'opacity-100' : 'opacity-0'}`}>
                            {selectedImageIndex > 0 && (
                                <button
                                    className={`absolute left-8 p-6 text-white/40 hover:text-white hover:bg-black/40 hover:scale-110 rounded-full transition-all z-[60] backdrop-blur-md border border-white/5 active:scale-95 ${navVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedImageIndex(selectedImageIndex - 1)
                                    }}
                                >
                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}

                            {selectedImageIndex < images.length - 1 && (
                                <button
                                    className={`absolute right-8 p-6 text-white/40 hover:text-white hover:bg-black/40 hover:scale-110 rounded-full transition-all z-[60] backdrop-blur-md border border-white/5 active:scale-95 ${navVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedImageIndex(selectedImageIndex + 1)
                                    }}
                                >
                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Main Image Container */}
                        <div
                            className={`relative flex items-center justify-center transition-all duration-700 ease-in-out p-12 ${uiVisible ? 'mb-40 scale-95' : 'mb-0 scale-100'}`}
                            style={{
                                width: '100%',
                                height: uiVisible ? 'calc(100% - 160px)' : '100%'
                            }}
                        >
                            <img
                                src={`media://local/${images[selectedImageIndex].filepath.replace(/\\/g, '/')}`}
                                alt=""
                                className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-md animate-in zoom-in-95 duration-700 selection:bg-transparent cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setUiVisible(!uiVisible)
                                }}
                            />
                        </div>

                        {/* Info Panel - Toggled via click */}
                        <div
                            className={`absolute bottom-0 inset-x-0 transition-all duration-500 ease-in-out transform z-[60] ${uiVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="mx-auto max-w-5xl px-8 pb-10">
                                <div className="bg-gray-900/95 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-[0_-30px_60px_rgba(0,0,0,0.6)] space-y-5">
                                    <div className="flex items-start justify-between gap-8">
                                        <div className="space-y-2 min-w-0 flex-1">
                                            <div className="flex items-center gap-4">
                                                <h3 className="text-2xl font-black text-white truncate tracking-tight">
                                                    {images[selectedImageIndex].filepath.split('\\').pop()}
                                                </h3>
                                                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                                                    Info Panel
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 font-mono break-all opacity-60 hover:opacity-100 transition-opacity cursor-default selection:bg-indigo-500/50">
                                                {images[selectedImageIndex].filepath}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => handleOpenInExplorer(e, images[selectedImageIndex].filepath)}
                                            className="p-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-2xl border border-white/10 transition-all flex-shrink-0 group shadow-lg"
                                            title="Open in Explorer"
                                        >
                                            <FolderOpen className="w-7 h-7 group-hover:scale-110 transition-transform" />
                                        </button>
                                    </div>

                                    {selectedImageTags.length > 0 ? (
                                        <div className="flex flex-wrap gap-2.5 pt-2 max-h-48 overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                            {selectedImageTags.map(tag => (
                                                <button
                                                    key={`img-tag-${tag.id}`}
                                                    onClick={() => {
                                                        setActiveTag(tag.name)
                                                        setSelectedImageIndex(null)
                                                    }}
                                                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border shadow-sm ${tag.is_favorite
                                                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20 active:scale-95'
                                                        : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white active:scale-95'
                                                        }`}
                                                >
                                                    <Hash className={`w-4 h-4 ${tag.is_favorite ? 'text-yellow-500' : 'opacity-30'}`} />
                                                    {tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                                            <p className="text-sm text-gray-500 font-medium">This image hasn't been tagged yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Settings Modal */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-indigo-400" />
                                Settings
                            </h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Multithreading Setting */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-300 flex items-center justify-between">
                                    Analysis Threads
                                    <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                        {settings.threadCount} threads
                                    </span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="8"
                                    step="1"
                                    value={settings.threadCount}
                                    onChange={(e) => handleUpdateThreadCount(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                                    <span>Single (Stable)</span>
                                    <span>Faster</span>
                                    <span>Aggressive</span>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed bg-gray-950/50 p-3 rounded-lg border border-gray-800">
                                    Determines how many images are analyzed simultaneously. Higher values speed up scanning but consume more GPU/CPU resources.
                                </p>
                            </div>

                            <div className="h-px bg-gray-800" />

                            {/* Database Operations */}
                            <div className="space-y-4">
                                <label className="text-sm font-semibold text-gray-300">Library Management</label>

                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            handleRescanLibrary()
                                            setShowSettings(false)
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Rescan Library (Maintenance)
                                    </button>
                                    <p className="text-[10px] text-gray-500 px-1">
                                        Checks for missing files and re-analyzes all images in the library.
                                    </p>
                                </div>

                                <div className="pt-2 space-y-2">
                                    <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            DANGER ZONE
                                        </p>
                                        <p className="text-[9px] text-red-500/70 mt-0.5">
                                            Destructive action. Resets all tags and associations.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            handleClearLibrary()
                                            setShowSettings(false)
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/5 hover:bg-red-500/20 text-red-500/60 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Clear All Library Data
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-950/50 border-t border-gray-800 flex justify-end">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
