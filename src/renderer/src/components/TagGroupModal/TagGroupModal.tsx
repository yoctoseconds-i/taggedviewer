import { useState, useEffect, useMemo } from 'react'
import { X, Search, Check, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { Tag, TagGroup } from '../../types'
import { useTranslation } from 'react-i18next'

interface TagGroupModalProps {
    isOpen: boolean
    onClose: () => void
    groupToEdit?: TagGroup | null
    initialTags?: Tag[] // For creating from current selection
    availableTags: Tag[]
    onSave: (name: string, tagIds: number[]) => void
    onDelete?: (id: number) => void
}

export const TagGroupModal = ({
    isOpen,
    onClose,
    groupToEdit,
    initialTags = [],
    availableTags,
    onSave,
    onDelete,
}: TagGroupModalProps) => {
    const { t } = useTranslation()
    const [name, setName] = useState('')
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (isOpen) {
            if (groupToEdit) {
                setName(groupToEdit.name)
                setSelectedTagIds(new Set(groupToEdit.tags.map((t) => t.id)))
            } else {
                setName('')
                setSelectedTagIds(new Set(initialTags.map((t) => t.id)))
            }
            setSearchTerm('')
        }
    }, [isOpen, groupToEdit, initialTags])

    const filteredTags = useMemo(() => {
        return availableTags.filter((tag) => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }, [availableTags, searchTerm])

    const toggleTag = (id: number) => {
        const newSet = new Set(selectedTagIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedTagIds(newSet)
    }

    const handleSave = () => {
        if (!name.trim()) return
        onSave(name, Array.from(selectedTagIds))
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <TagIcon className="w-5 h-5 text-indigo-500" />
                        {groupToEdit ? t('groupModal.editTitle') : t('groupModal.newTitle')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-hidden flex flex-col space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {t('groupModal.nameLabel')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('groupModal.namePlaceholder')}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1 flex-1 flex flex-col min-h-0">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {t('groupModal.includeLabel')} ({selectedTagIds.size})
                        </label>

                        {/* Tag Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('groupModal.searchPlaceholder')}
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>

                        {/* Tag List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-800 rounded-lg bg-gray-950/50 p-2 mt-2">
                            <div className="grid grid-cols-2 gap-2">
                                {filteredTags.map((tag) => {
                                    const isSelected = selectedTagIds.has(tag.id)
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag(tag.id)}
                                            className={`flex items-center justify-between px-3 py-2 rounded-md text-sm border transition-all ${isSelected
                                                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                                                : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                }`}
                                        >
                                            <span className="truncate mr-2">{tag.name}</span>
                                            {isSelected ? (
                                                <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            ) : (
                                                <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 shrink-0" />
                                            )}
                                        </button>
                                    )
                                })}
                                {filteredTags.length === 0 && (
                                    <div className="col-span-2 text-center text-gray-500 py-4 text-xs">
                                        {t('groupModal.noTagsFound')} "{searchTerm}"
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-between shrink-0 bg-gray-900/50">
                    <div>
                        {groupToEdit && onDelete && (
                            <button
                                onClick={() => {
                                    if (confirm(t('common.confirmDelete'))) {
                                        onDelete(groupToEdit.id)
                                        onClose()
                                    }
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {t('common.delete')}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!name.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {groupToEdit ? t('common.save') : t('common.create')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
