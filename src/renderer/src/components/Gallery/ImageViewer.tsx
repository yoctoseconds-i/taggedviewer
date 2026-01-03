import { X, FolderOpen, Star } from 'lucide-react'
import { Image as ImageType, Tag } from '../../types'

interface ImageViewerProps {
  image: ImageType
  tags: Tag[]
  onClose: () => void
  onOpenFolder: (path: string) => void
  onToggleFavorite: (id: number) => void
  onTagClick: (name: string) => void
}

export const ImageViewer = ({
  image,
  tags,
  onClose,
  onOpenFolder,
  onToggleFavorite,
  onTagClick,
}: ImageViewerProps) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <img
          src={`media://${encodeURI(image.filepath.replace(/\\/g, '/'))}`}
          className="max-h-full max-w-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-500"
          alt=""
          onClick={(e) => e.stopPropagation()}
        />

        <button
          onClick={onClose}
          className="absolute top-6 left-6 p-2 bg-gray-900/50 hover:bg-gray-800 border border-gray-800 rounded-full text-white transition-all hover:rotate-90 active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        className="w-80 bg-gray-900/50 border-l border-white/10 p-6 flex flex-col animate-in slide-in-from-right duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-8">
          <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">
            File Information
          </h3>
          <p className="text-white text-sm font-bold break-all leading-tight">
            {image.filepath.split(/[\\\/]/).pop()}
          </p>
          <button
            onClick={() => onOpenFolder(image.filepath)}
            className="mt-4 flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg border border-white/5 transition-all active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Show in Explorer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">
            Tags ({tags.length})
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
                  className={`p-1 rounded-full transition-colors ${tag.is_favorite ? 'bg-amber-400/20' : 'hover:bg-white/10'
                    }`}
                >
                  <Star
                    className={`w-3 h-3 ${tag.is_favorite ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                      }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
