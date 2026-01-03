import { Loader2 } from 'lucide-react'

interface ScanningProgressProps {
  current: number
  total: number
}

export const ScanningProgress = ({ current, total }: ScanningProgressProps) => {
  const progress = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-gray-900/90 backdrop-blur-md border border-indigo-500/30 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 min-w-[280px]">
        <div className="relative flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <span className="absolute text-[10px] font-black text-indigo-400">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-end mb-1.5">
            <p className="text-xs font-black text-white uppercase tracking-tighter">
              Scanning Library
            </p>
            <p className="text-[10px] font-mono text-gray-500">
              {current} / {total}
            </p>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
