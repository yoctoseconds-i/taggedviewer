import { X, Settings as SettingsIcon, Trash2, RefreshCw, AlertTriangle, Download } from 'lucide-react'
import { Settings } from '../../types'

interface SettingsModalProps {
  show: boolean
  onClose: () => void
  settings: Settings
  onUpdateThreadCount: (count: number) => void
  onRescan: () => void
  onClear: () => void
  version?: string
  updateStatus?: { available: boolean; info?: any; checking: boolean }
  onCheckForUpdates?: () => void
}

export const SettingsModal = ({
  show,
  onClose,
  settings,
  onUpdateThreadCount,
  onRescan,
  onClear,
  version,
  updateStatus,
  onCheckForUpdates,
}: SettingsModalProps) => {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-indigo-400" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
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
              onChange={(e) => onUpdateThreadCount(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-medium">
              <span>Single (Stable)</span>
              <span>Faster</span>
              <span>Aggressive</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed bg-gray-950/50 p-3 rounded-lg border border-gray-800">
              Determines how many images are analyzed simultaneously. Higher values speed up
              scanning but consume more GPU/CPU resources.
            </p>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-4">
            <label className="text-sm font-semibold text-gray-300">Library Management</label>

            <div className="space-y-2">
              <button
                onClick={onRescan}
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
                onClick={onClear}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/5 hover:bg-red-500/20 text-red-500/60 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Library Data
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-300">App Information</label>
              {version && <span className="text-[10px] text-gray-500 font-mono">v{version}</span>}
            </div>

            <div className="bg-gray-950/50 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300 font-medium">Software Updates</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Check for latest versions on GitHub.
                  </p>
                </div>
                <button
                  onClick={onCheckForUpdates}
                  disabled={updateStatus?.checking}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-bold rounded-lg border border-gray-700 transition-all active:scale-95"
                >
                  {updateStatus?.checking ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    'Check Updates'
                  )}
                </button>
              </div>

              {updateStatus?.available && (
                <div className="px-4 py-3 bg-indigo-500/10 border-t border-indigo-500/20 flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Download className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-indigo-300 font-bold">
                      New Version Available: v{updateStatus.info?.version}
                    </p>
                    <p className="text-[9px] text-indigo-400/70 truncate">
                      Go to GitHub to download the latest installer.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      window.electron.shell.openExternal(
                        'https://github.com/rshkkngtm08/taggedviewer/releases'
                      )
                    }
                    className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-bold rounded-md shadow-lg shadow-indigo-500/20 transition-all active:scale-95 whitespace-nowrap"
                  >
                    Get Update
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-950/50 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
