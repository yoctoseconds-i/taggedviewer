import { ArrowUpDown, Settings as SettingsIcon, Search, Star } from 'lucide-react'
import { Tag } from '../../types'

interface SidebarProps {
  tags: Tag[]
  activeTags: string[]
  onTagClick: (tagName: string | null) => void
  tagSort: 'name' | 'count'
  onToggleSort: () => void
  onOpenSettings: () => void
  tagSearchTerm: string
  onSearchChange: (term: string) => void
  onToggleFavorite: (id: number) => void
}

export const Sidebar = ({
  tags,
  activeTags,
  onTagClick,
  tagSort,
  onToggleSort,
  onOpenSettings,
  tagSearchTerm,
  onSearchChange,
  onToggleFavorite,
}: SidebarProps) => {
  const favoriteTags = tags.filter((t) => t.is_favorite)
  const otherTags = tags.filter((t) => !t.is_favorite)

  const renderTag = (tag: Tag) => {
    const isActive = activeTags.includes(tag.name)
    return (
      <div
        key={tag.id}
        className={`group w-full flex items-center rounded-lg text-xs font-medium transition-all border ${isActive
            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200 border-transparent'
          }`}
      >
        <button
          onClick={() => onTagClick(tag.name)}
          className="flex-1 text-left px-3 py-2 flex items-center justify-between overflow-hidden"
        >
          <span className="truncate">{tag.name}</span>
          {tag.count !== undefined && (
            <span
              className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${isActive
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'bg-gray-900 text-gray-500 group-hover:bg-gray-800'
                }`}
            >
              {tag.count}
            </span>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(tag.id)
          }}
          aria-label={tag.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`px-2 py-2 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 ${tag.is_favorite ? 'opacity-100 text-amber-400' : 'text-gray-600 hover:text-amber-400'
            }`}
        >
          <Star className={`w-3.5 h-3.5 ${tag.is_favorite ? 'fill-amber-400' : ''}`} />
        </button>
      </div>
    )
  }

  return (
    <nav className="w-64 border-r border-gray-800 flex flex-col bg-gray-950">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50 shrink-0">
        <h1 className="text-sm font-black tracking-tighter text-white uppercase italic">
          Tagged<span className="text-indigo-500">Viewer</span>
        </h1>
        <div className="flex items-center space-x-1">
          <button
            onClick={onToggleSort}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
            title={tagSort === 'name' ? 'Sort by Count' : 'Sort by Name'}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 shrink-0">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            placeholder="Search tags..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg py-2 pl-8 pr-3 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            value={tagSearchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-4 pb-4">
        {/* All Images Section */}
        <div>
          <button
            onClick={() => onTagClick(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group ${activeTags.length === 0
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent'
              }`}
          >
            <span>All Images</span>
          </button>
        </div>

        {/* Favorites Section */}
        {favoriteTags.length > 0 && (
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Favorites
              </span>
              <div className="h-px flex-1 bg-gray-800/50 ml-3" />
            </div>
            <div className="space-y-0.5">{favoriteTags.map(renderTag)}</div>
          </div>
        )}

        {/* Tags Section */}
        {otherTags.length > 0 && (
          <div>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Tags
              </span>
              <div className="h-px flex-1 bg-gray-800/50 ml-3" />
            </div>
            <div className="space-y-0.5">{otherTags.map(renderTag)}</div>
          </div>
        )}
      </div>
    </nav>
  )
}
