import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SelectedTagsBarProps {
  selectedTags: string[]
  onRemoveTag: (tag: string) => void
  onClearAll: () => void
}

export const SelectedTagsBar = ({
  selectedTags,
  onRemoveTag,
  onClearAll,
}: SelectedTagsBarProps) => {
  const { t } = useTranslation()
  if (selectedTags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-gray-900/50 border-b border-gray-800">
      <span className="text-xs font-medium text-gray-500 mr-2">{t('gallery.filters')}</span>
      {selectedTags.map((tag) => (
        <div
          key={tag}
          className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full group hover:bg-indigo-500/30 transition-colors"
        >
          <span className="text-xs font-medium text-indigo-300">{tag}</span>
          <button
            onClick={() => onRemoveTag(tag)}
            className="p-0.5 rounded-full hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-200 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={onClearAll}
        className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {t('gallery.clearAll')}
      </button>
    </div>
  )
}
