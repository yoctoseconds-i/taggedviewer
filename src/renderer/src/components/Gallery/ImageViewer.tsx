import { X, FolderOpen, Star, ChevronLeft, ChevronRight, Info, Copy } from 'lucide-react'
import { Image as ImageType, Tag } from '../../types'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'

interface ImageViewerProps {
  image: ImageType
  tags: Tag[]
  onClose: () => void
  onOpenFolder: (path: string) => void
  onToggleFavorite: (id: number) => void
  onTagClick: (name: string) => void
  onPrev?: () => void
  onNext?: () => void
}

export const ImageViewer = ({
  image,
  tags,
  onClose,
  onOpenFolder,
  onToggleFavorite,
  onTagClick,
  onPrev,
  onNext,
}: ImageViewerProps) => {
  const { t } = useTranslation()
  const [isDetailVisible, setIsDetailVisible] = useState(false)
  const [isControlsVisible, setIsControlsVisible] = useState(true)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [metadata, setMetadata] = useState<any>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleMouseMove = () => {
      setIsControlsVisible(true)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false)
      }, 3000)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return
      }
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    const fetchMetadata = async () => {
      // @ts-ignore
      const meta = await window.electron.ipcRenderer.invoke('image:getMetadata', image.filepath)
      setMetadata(meta)
    }
    fetchMetadata()
  }, [image.filepath])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex animate-in fade-in duration-300">
      {/* Navigation Arrows */}
      {onPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          className={`fixed left-4 top-1/2 -translate-y-1/2 z-[60] p-4 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all duration-300 ${
            isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-label="Previous image"
          title={t('viewer.prev')}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className={`fixed right-4 top-1/2 -translate-y-1/2 z-[60] p-4 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all duration-300 ${
            isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${isDetailVisible ? 'mr-80' : ''}`}
          aria-label="Next image"
          title={t('viewer.next')}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Main Image Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative cursor-pointer"
        onClick={() => setIsDetailVisible(!isDetailVisible)}
      >
        <img
          key={image.filepath}
          src={`media://${encodeURI(image.filepath.replace(/\\/g, '/'))}`}
          className="max-h-full max-w-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-500"
          alt=""
          onClick={(e) => e.stopPropagation()}
        />

        {/* Close Button top-left */}
        <button
          onClick={onClose}
          className={`absolute top-6 left-6 p-2 bg-gray-900/50 hover:bg-gray-800 border border-gray-800 rounded-full text-white transition-all hover:rotate-90 active:scale-95 z-[60] ${
            isControlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Close viewer"
          title={t('viewer.close')}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Info Toggle indicator if hidden */}
        {!isDetailVisible && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsDetailVisible(true)
            }}
            className={`absolute bottom-6 right-6 p-3 bg-indigo-600/50 hover:bg-indigo-600 text-white rounded-full transition-all z-[60] ${
              isControlsVisible ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Show info"
            title={t('viewer.fileInfo')}
          >
            <Info className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Detail Pane */}
      {isDetailVisible && (
        <div
          className="w-80 bg-gray-900/80 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col animate-in slide-in-from-right duration-500 z-[70]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1 overflow-hidden">
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">
                {t('viewer.fileInfo')}
              </h3>
              <p className="text-white text-sm font-bold break-all leading-tight pr-2">
                {image.filepath.split(/[\\\/]/).pop()}
              </p>
            </div>
            <button
              onClick={() => setIsDetailVisible(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            <button
              onClick={() => onOpenFolder(image.filepath)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2.5 rounded-xl border border-white/5 transition-all active:scale-95"
            >
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              {t('viewer.showInExplorer')}
            </button>

            {metadata && (
              <button
                onClick={() => setShowPromptModal(true)}
                className="flex items-center gap-2 text-xs text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2.5 rounded-xl border border-indigo-500/20 transition-all active:scale-95"
              >
                <Info className="w-4 h-4" />
                {t('viewer.showPrompt')}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">
              {t('viewer.tags')} ({tags.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onTagClick(tag.name)}
                  className="group flex items-center gap-2 bg-gray-800/50 hover:bg-indigo-500/20 text-gray-300 hover:text-indigo-300 px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 hover:border-indigo-500/30 transition-all active:scale-90"
                >
                  {tag.name}
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(tag.id)
                    }}
                    className={`p-1 rounded-full transition-colors ${
                      tag.is_favorite ? 'bg-amber-400/20' : 'hover:bg-white/10'
                    }`}
                  >
                    <Star
                      className={`w-3 h-3 ${
                        tag.is_favorite ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowPromptModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <Info className="w-6 h-6 text-indigo-500" />
                {t('viewer.promptTitle')}
              </h2>
              <button
                onClick={() => setShowPromptModal(false)}
                className="p-2 hover:bg-white/10 rounded-full text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/50 rounded-xl p-4 border border-white/5">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {JSON.stringify(metadata.text, null, 2)}
              </pre>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(metadata.text))
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm transition-all"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold"
              >
                {t('viewer.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
