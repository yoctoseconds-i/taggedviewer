
import { ArrowDownAZ, ArrowUpAZ, Calendar, FileText, Shuffle, Type } from 'lucide-react'

export type SortKey = 'date' | 'name' | 'ext' | 'random'
export type SortOrder = 'asc' | 'desc'

interface SortControlProps {
    sortKey: SortKey
    sortOrder: SortOrder
    onSortChange: (key: SortKey, order: SortOrder) => void
}

export const SortControl = ({ sortKey, sortOrder, onSortChange }: SortControlProps) => {
    const toggleOrder = () => {
        onSortChange(sortKey, sortOrder === 'asc' ? 'desc' : 'asc')
    }

    const handleKeyChange = (key: SortKey) => {
        if (key === sortKey && key !== 'random') {
            toggleOrder()
        } else {
            onSortChange(key, 'asc') // Default to asc for new key, except probably date/random but keeping simple provided logic
        }
    }

    const getIcon = (key: SortKey) => {
        switch (key) {
            case 'date': return <Calendar className="w-3.5 h-3.5" />
            case 'name': return <Type className="w-3.5 h-3.5" />
            case 'ext': return <FileText className="w-3.5 h-3.5" />
            case 'random': return <Shuffle className="w-3.5 h-3.5" />
        }
    }

    const getLabel = (key: SortKey) => {
        switch (key) {
            case 'date': return 'Date'
            case 'name': return 'Name'
            case 'ext': return 'Type'
            case 'random': return 'Random'
        }
    }

    return (
        <div className="flex items-center space-x-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            {(['date', 'name', 'ext', 'random'] as SortKey[]).map((key) => (
                <button
                    key={key}
                    onClick={() => handleKeyChange(key)}
                    className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${sortKey === key
                            ? 'bg-indigo-500/20 text-indigo-300 shadow-sm'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                        }`}
                    title={`Sort by ${getLabel(key)}`}
                >
                    {getIcon(key)}
                    <span className="hidden xl:inline">{getLabel(key)}</span>
                    {sortKey === key && key !== 'random' && (
                        <span className="ml-1 opacity-70">
                            {sortOrder === 'asc' ? <ArrowUpAZ className="w-3 h-3" /> : <ArrowDownAZ className="w-3 h-3" />}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
