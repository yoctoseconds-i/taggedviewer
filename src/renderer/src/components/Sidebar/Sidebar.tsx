import {
  ArrowUpDown,
  Settings as SettingsIcon,
  Search,
  Star,
  Layers,
  Plus,
  Pencil,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Tag, TagGroup } from '../../types'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'

interface SidebarProps {
  tags: Tag[]
  activeTags: string[]
  onTagClick: (tagName: string | null) => void
  onToggleSort: () => void
  onOpenSettings: () => void
  showHidden: boolean
  onToggleShowHidden: () => void
  onToggleHidden: (id: number) => void
  tagSearchTerm: string
  onSearchChange: (term: string) => void
  onToggleFavorite: (id: number) => void
  tagGroups: TagGroup[]
  onGroupClick: (group: TagGroup) => void
  onCreateGroup: () => void
  onEditGroup: (group: TagGroup) => void
  libraryPath: string | null
  onOpenLibrary: () => void
}

export const Sidebar = ({
  tags,
  activeTags,
  onTagClick,

  onToggleSort,
  onOpenSettings,
  showHidden,
  onToggleShowHidden,
  onToggleHidden,
  tagSearchTerm,
  onSearchChange,
  onToggleFavorite,
  tagGroups = [],
  onGroupClick,
  onCreateGroup,
  onEditGroup,
  libraryPath,
  onOpenLibrary,
}: SidebarProps) => {
  const { t } = useTranslation()
  const favoriteTags = tags.filter((t) => t.is_favorite && (!t.is_hidden || showHidden))
  const otherTags = tags.filter((t) => !t.is_favorite && (!t.is_hidden || showHidden))

  const renderTag = (tag: Tag) => {
    const isActive = activeTags.includes(tag.name)
    return (
      <div
        key={tag.id}
        className={`group w-full flex items-center rounded-lg text-xs font-medium transition-all border ${
          isActive
            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200 border-transparent'
        } ${tag.is_hidden ? 'opacity-50 grayscale-[0.5]' : ''}`}
      >
        <button
          onClick={() => onTagClick(tag.name)}
          className="flex-1 text-left px-3 py-2 flex items-center justify-between overflow-hidden"
        >
          <span className="truncate">{tag.name}</span>
          {tag.count !== undefined && (
            <span
              className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                isActive
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
          className={`px-2 py-2 transition-colors flex items-center justify-center ${
            tag.is_favorite
              ? 'opacity-100 text-amber-400'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-600 hover:text-amber-400'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${tag.is_favorite ? 'fill-amber-400' : ''}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleHidden(tag.id)
          }}
          aria-label={tag.is_hidden ? t('sidebar.unhideTag') : t('sidebar.hideTag')}
          title={tag.is_hidden ? t('sidebar.unhideTag') : t('sidebar.hideTag')}
          className={`px-2 py-2 transition-colors flex items-center justify-center ${
            tag.is_hidden
              ? 'opacity-100 text-red-400'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-600 hover:text-red-400'
          }`}
        >
          {tag.is_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    )
  }

  return (
    <nav className="w-64 border-r border-gray-800 flex flex-col bg-gray-950">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50 shrink-0">
        <div className="flex flex-col min-w-0 mr-2">
          <h1 className="text-sm font-black tracking-tighter text-white uppercase italic truncate">
            Tagged<span className="text-indigo-500">Viewer</span>
          </h1>
          <button
            onClick={onOpenLibrary}
            className="text-[10px] text-gray-500 hover:text-indigo-400 truncate text-left transition-colors flex items-center gap-1"
            title={libraryPath || 'No Library Open'}
          >
            <Layers className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {libraryPath ? libraryPath.split(/[\\/]/).pop() : 'Open Library'}
            </span>
          </button>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={onToggleSort}
            className="p-1.5 text-gray-500 hover:text-indigo-400 disabled:opacity-50 transition-colors"
            title={t('sidebar.toggleSort')}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleShowHidden}
            className={`p-1.5 transition-colors ${
              showHidden ? 'text-indigo-400' : 'text-gray-500 hover:text-indigo-400'
            }`}
            title={t('sidebar.showHidden')}
          >
            {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-gray-500 hover:text-indigo-400 transition-colors"
            title={t('sidebar.settings')}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 shrink-0">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
          <input
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg py-2 pl-8 pr-8 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            value={tagSearchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {tagSearchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white transition-colors"
              title={t('common.clear')} // Assuming common.clear exists or will be added
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-4 pb-4">
        {/* All Images Section */}
        <div>
          <button
            onClick={() => onTagClick(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group ${
              activeTags.length === 0
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent'
            }`}
          >
            <span>{t('sidebar.allImages')}</span>
          </button>
        </div>

        {/* Favorites Section */}
        {favoriteTags.length > 0 && (
          <div className="flex flex-col h-[200px] min-h-[100px]">
            <div className="px-3 mb-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {t('sidebar.favorites')}
              </span>
              <div className="h-px flex-1 bg-gray-800/50 ml-3" />
            </div>
            <div className="flex-1">
              <Virtuoso
                style={{ height: '100%' }}
                data={favoriteTags}
                itemContent={(_, tag) => <div className="py-0.5">{renderTag(tag)}</div>}
              />
            </div>
          </div>
        )}

        {/* Tag Groups Section */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between group/header">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-3 h-3" />
              {t('sidebar.tagGroups')}
            </span>
            <button
              onClick={onCreateGroup}
              className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover/header:opacity-100"
              title={t('sidebar.createGroup')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {tagGroups.map((group) => (
              <div
                key={group.id}
                className="group w-full flex items-center rounded-lg text-xs font-medium transition-all border border-transparent hover:bg-gray-900 group-hover:border-gray-800"
              >
                <button
                  onClick={() => onGroupClick(group)}
                  className="flex-1 text-left px-3 py-2 text-gray-400 hover:text-gray-200"
                >
                  <span className="truncate">{group.name}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditGroup(group)
                  }}
                  className="px-2 py-2 text-gray-600 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
                  title={t('sidebar.editGroup')}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            ))}
            {tagGroups.length === 0 && (
              <div className="px-3 py-2 text-[10px] text-gray-600 italic">
                {t('sidebar.noGroups')}
              </div>
            )}
          </div>
        </div>

        {/* Tags Section */}
        {otherTags.length > 0 && (
          <div className="flex flex-col h-[400px] min-h-[200px]">
            <div className="px-3 mb-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {t('sidebar.tags')}
              </span>
              <div className="h-px flex-1 bg-gray-800/50 ml-3" />
            </div>
            <div className="flex-1">
              <Virtuoso
                style={{ height: '100%' }}
                data={otherTags}
                itemContent={(_, tag) => <div className="py-0.5">{renderTag(tag)}</div>}
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
