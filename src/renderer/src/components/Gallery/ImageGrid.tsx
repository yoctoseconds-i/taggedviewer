import { ImageIcon } from 'lucide-react'
import { Image as ImageType } from '../../types'

interface ImageGridProps {
  images: ImageType[]
  onImageClick: (index: number) => void
}

export const ImageGrid = ({ images, onImageClick }: ImageGridProps) => {
  if (images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-4 animate-in fade-in zoom-in duration-500">
        <div className="p-6 rounded-full bg-gray-900/50 border border-gray-800 shadow-inner">
          <ImageIcon className="w-12 h-12 text-gray-700" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">No images found</p>
          <p className="text-xs text-gray-600 mt-1">Try selecting a different tag or folder</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4">
      {images.map((img, idx) => (
        <div
          key={img.id}
          onClick={() => onImageClick(idx)}
          className="aspect-square relative group bg-gray-900 rounded-xl overflow-hidden cursor-pointer border border-gray-800 hover:border-indigo-500/50 shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 active:scale-95"
        >
          <img
            src={`media:///${img.filepath}`}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
            <p className="text-[10px] text-gray-300 truncate font-medium">
              {img.filepath.split(/[\\\/]/).pop()}
            </p>
          </div>
          {!img.processed && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
          )}
        </div>
      ))}
    </div>
  )
}
