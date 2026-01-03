import { ArrowUpDown, Settings as SettingsIcon, Search, Star } from 'lucide-react'
import { Tag } from '../../types'

interface SidebarProps {
  tags: Tag[]
  activeTag: string | null
  onTagClick: (tagName: string | null) => void
  tagSort: 'name' | 'count'
  onToggleSort: () => void
  onOpenSettings: () => void
  tagSearchTerm: string
  onSearchChange: (term: string) => void
}

export const Sidebar = ({
  tags,
  activeTag,
  onTagClick,
  tagSort,
  onToggleSort,
  onOpenSettings,
  tagSearchTerm,
  onSearchChange,
}: SidebarProps) => {
  return (
    <nav className="w-64 border-r border-gray-800 flex flex-col bg-gray-950">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
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

      <div className="p-3">
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

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-0.5 pb-4">
        <button
          onClick={() => onTagClick(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group ${
            activeTag === null
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent'
          }`}
        >
          <span>All Images</span>
        </button>

        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => onTagClick(tag.name)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group ${
              activeTag === tag.name
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {tag.is_favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
              <span className="truncate">{tag.name}</span>
            </div>
            {tag.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  activeTag === tag.name
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-gray-900 text-gray-500 group-hover:bg-gray-800'
                }`}
              >
                {tag.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
