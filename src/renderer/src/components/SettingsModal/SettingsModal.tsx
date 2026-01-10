import {
  X,
  Settings as SettingsIcon,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Download,
  Languages,
  FolderOpen,
  FolderSync,
} from 'lucide-react'
import { Settings } from '../../types'
import { useTranslation } from 'react-i18next'

interface SettingsModalProps {
  show: boolean
  onClose: () => void
  settings: Settings
  onUpdateThreadCount: (count: number) => void
  onUpdateLanguage: (lang: string) => void
  onRescan: () => void
  onClear: () => void
  version?: string
  updateStatus?: { available: boolean; info?: any; checking: boolean }
  onCheckForUpdates?: () => void
  onSelectLibrary: () => void
}

export const SettingsModal = ({
  show,
  onClose,
  settings,
  onUpdateThreadCount,
  onUpdateLanguage,
  onRescan,
  onClear,
  version,
  updateStatus,
  onCheckForUpdates,
  onSelectLibrary,
}: SettingsModalProps) => {
  const { t, i18n } = useTranslation()
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-indigo-400" />
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Language Settings */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-indigo-400" />
                {t('settings.language')}
              </span>
              <select
                className="bg-gray-800 border-none text-xs rounded-md px-2 py-1 text-gray-300 focus:ring-1 focus:ring-indigo-500"
                value={settings.language || 'en'}
                onChange={(e) => {
                  const newLang = e.target.value
                  onUpdateLanguage(newLang)
                  i18n.changeLanguage(newLang)
                }}
              >
                <option value="en">English (US)</option>
                <option value="ja">日本語 (JP)</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-300 flex items-center justify-between">
              {t('settings.threadCount')}
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
              <span>{t('settings.singleStable')}</span>
              <span>{t('settings.faster')}</span>
              <span>{t('settings.aggressive')}</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed bg-gray-950/50 p-3 rounded-lg border border-gray-800">
              {t('settings.threadCountDesc')}
            </p>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-4">
            <label className="text-sm font-semibold text-gray-300">{t('settings.library')}</label>

            <div className="space-y-4">
              <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                    {t('settings.libraryPath')}
                  </div>
                  <button
                    onClick={onSelectLibrary}
                    className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20 transition-all"
                  >
                    {t('settings.setLibrary')}
                  </button>
                </div>
                <div className="px-3 py-2 bg-black/40 rounded-lg border border-gray-800/50">
                  <p className="text-[10px] text-gray-400 font-mono break-all line-clamp-2">
                    {settings.libraryPath || 'No directory selected'}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <FolderSync className="w-3 h-3 text-indigo-500/50 mt-0.5" />
                  <p className="text-[9px] text-gray-500 leading-tight">
                    {t('settings.autoSyncDesc')}
                  </p>
                </div>
              </div>

              <button
                onClick={onRescan}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                {t('settings.rescan')}
              </button>
              <p className="text-[10px] text-gray-500 px-1">{t('settings.rescanDesc')}</p>
            </div>

            <div className="pt-2 space-y-2">
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('settings.dangerZone')}
                </p>
                <p className="text-[9px] text-red-500/70 mt-0.5">{t('settings.dangerZoneDesc')}</p>
              </div>
              <button
                onClick={onClear}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/5 hover:bg-red-500/20 text-red-500/60 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" />
                {t('settings.clear')}
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-300">{t('settings.appInfo')}</label>
              {version && <span className="text-[10px] text-gray-500 font-mono">v{version}</span>}
            </div>

            <div className="bg-gray-950/50 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300 font-medium">
                    {t('settings.softwareUpdates')}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {t('settings.softwareUpdatesDesc')}
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
                    t('settings.checkUpdates')
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
                      {t('settings.updateStatus.newVersion')}
                      {updateStatus.info?.version}
                    </p>
                    <p className="text-[9px] text-indigo-400/70 truncate">
                      {t('settings.updateStatus.download')}
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
                    {t('settings.updateStatus.getUpdate')}
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
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
