import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, ExternalLink, ChevronDown, ChevronUp, X } from 'lucide-react'
import { UpdateStatus } from '../../hooks/useIpc'

interface UpdateNotificationProps {
  updateStatus: UpdateStatus
  onDismiss: () => void
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  updateStatus,
  onDismiss,
}) => {
  const { t } = useTranslation()
  const [showNotes, setShowNotes] = useState(false)

  if (!updateStatus.available || updateStatus.dismissed) {
    return null
  }

  const handleOpenRelease = () => {
    const url = updateStatus.htmlUrl || 'https://github.com/yoctoseconds-i/taggedviewer/releases'
    if ((window as any).electron?.shell) {
      ;(window as any).electron.shell.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="relative z-40 bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-slate-900/90 border-b border-indigo-500/30 text-white backdrop-blur-md shadow-lg transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg shrink-0 border border-indigo-500/30 shadow-inner">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-indigo-100">
                  {t('settings.updateBanner.title')}
                </span>
                {updateStatus.version && (
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 rounded-full border border-indigo-400/30">
                    v{updateStatus.version}
                  </span>
                )}
              </div>
              {updateStatus.releaseName &&
                updateStatus.releaseName !== `v${updateStatus.version}` && (
                  <p className="text-xs text-indigo-200/80 truncate mt-0.5">
                    {updateStatus.releaseName}
                  </p>
                )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            {updateStatus.releaseNotes && (
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="px-2.5 py-1 text-xs font-medium text-indigo-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors flex items-center gap-1"
              >
                <span>
                  {showNotes
                    ? t('settings.updateBanner.hideNotes')
                    : t('settings.updateBanner.showNotes')}
                </span>
                {showNotes ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              onClick={handleOpenRelease}
              className="px-3 py-1 text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white rounded-md shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>{t('settings.updateBanner.viewRelease')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onDismiss}
              title={t('settings.updateBanner.dismiss')}
              className="p-1 text-indigo-300 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showNotes && updateStatus.releaseNotes && (
          <div className="mt-2.5 pt-2.5 border-t border-indigo-500/20 text-xs text-indigo-100/90 bg-black/20 p-3 rounded-lg max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
            {updateStatus.releaseNotes}
          </div>
        )}
      </div>
    </div>
  )
}
