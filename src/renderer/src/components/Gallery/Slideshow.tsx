import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Shuffle,
  Repeat,
  Clock,
} from 'lucide-react'
import { Image as ImageType } from '../../types'
import { useTranslation } from 'react-i18next'

interface SlideshowProps {
  images: ImageType[]
  startIndex: number
  onClose: () => void
  onImageClick: (index: number) => void
}

export const Slideshow = ({ images, startIndex, onClose, onImageClick }: SlideshowProps) => {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(startIndex)
  const [isPlaying, setIsPlaying] = useState(true)
  const [intervalSeconds, setIntervalSeconds] = useState(5)
  const [playOrder, setPlayOrder] = useState<'normal' | 'random'>('normal')
  const [isLoop, setIsLoop] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [isControlsVisible, setIsControlsVisible] = useState(true)
  const [metadata, setMetadata] = useState<any>(null)

  // Random playback history / order
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([])
  const [shuffledPosition, setShuffledPosition] = useState(0)

  // Keep track of the latest currentIndex using a ref to avoid dependency cycle in shuffle effect
  const currentIndexRef = useRef(currentIndex)
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressStartRef = useRef<number>(0)
  const [progressWidth, setProgressWidth] = useState(0)
  const animationFrameRef = useRef<number | null>(null)

  const currentImage = images[currentIndex]

  // Initialize and handle playOrder changes
  useEffect(() => {
    if (playOrder === 'random') {
      const indices = Array.from({ length: images.length }, (_, i) => i)
      // Fisher-Yates Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      // Put currently selected index at the start so we don't jump immediately
      const activeIdx = currentIndexRef.current
      const currentPosInShuffled = indices.indexOf(activeIdx)
      if (currentPosInShuffled !== -1) {
        indices.splice(currentPosInShuffled, 1)
        indices.unshift(activeIdx)
      }
      setShuffledIndices(indices)
      setShuffledPosition(0)
    }
  }, [playOrder, images.length])

  // Fetch metadata when image changes
  useEffect(() => {
    if (!currentImage) return
    const fetchMetadata = async () => {
      try {
        // @ts-ignore
        const meta = await window.electron.ipcRenderer.invoke(
          'image:getMetadata',
          currentImage.filepath
        )
        setMetadata(meta)
      } catch (err) {
        console.error('Failed to load metadata', err)
        setMetadata(null)
      }
    }
    fetchMetadata()
  }, [currentImage])

  // Reset controls hide timer on move
  const handleMouseMove = useCallback(() => {
    setIsControlsVisible(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      setIsControlsVisible(false)
    }, 3000)
  }, [])

  // Navigation Logic
  const handleNext = useCallback(() => {
    if (images.length === 0) return

    if (playOrder === 'random') {
      if (shuffledIndices.length === 0) return
      const nextPos = shuffledPosition + 1
      if (nextPos >= shuffledIndices.length) {
        if (isLoop) {
          // Reshuffle
          const indices = Array.from({ length: images.length }, (_, i) => i)
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[indices[i], indices[j]] = [indices[j], indices[i]]
          }
          setShuffledIndices(indices)
          setShuffledPosition(0)
          setCurrentIndex(indices[0])
        } else {
          setIsPlaying(false)
        }
      } else {
        setShuffledPosition(nextPos)
        setCurrentIndex(shuffledIndices[nextPos])
      }
    } else {
      const nextIndex = currentIndex + 1
      if (nextIndex >= images.length) {
        if (isLoop) {
          setCurrentIndex(0)
        } else {
          setIsPlaying(false)
        }
      } else {
        setCurrentIndex(nextIndex)
      }
    }
    progressStartRef.current = Date.now()
  }, [currentIndex, images.length, playOrder, shuffledIndices, shuffledPosition, isLoop])

  const handlePrev = useCallback(() => {
    if (images.length === 0) return

    if (playOrder === 'random') {
      if (shuffledIndices.length === 0) return
      const prevPos = shuffledPosition - 1
      if (prevPos < 0) {
        if (isLoop) {
          const lastPos = shuffledIndices.length - 1
          setShuffledPosition(lastPos)
          setCurrentIndex(shuffledIndices[lastPos])
        }
      } else {
        setShuffledPosition(prevPos)
        setCurrentIndex(shuffledIndices[prevPos])
      }
    } else {
      const prevIndex = currentIndex - 1
      if (prevIndex < 0) {
        if (isLoop) {
          setCurrentIndex(images.length - 1)
        }
      } else {
        setCurrentIndex(prevIndex)
      }
    }
    progressStartRef.current = Date.now()
  }, [currentIndex, images.length, playOrder, shuffledIndices, shuffledPosition, isLoop])

  // Timer & Progress Animation Frame
  useEffect(() => {
    if (!isPlaying) {
      setProgressWidth(0)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      return
    }

    progressStartRef.current = Date.now()
    const limitMs = intervalSeconds * 1000

    const updateProgress = () => {
      const elapsed = Date.now() - progressStartRef.current
      const pct = Math.min((elapsed / limitMs) * 100, 100)
      setProgressWidth(pct)

      if (elapsed >= limitMs) {
        handleNext()
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateProgress)

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [isPlaying, intervalSeconds, handleNext])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          setIsPlaying((prev) => !prev)
          break
        case 'ArrowLeft':
          handlePrev()
          break
        case 'ArrowRight':
          handleNext()
          break
        case 'Escape':
          onClose()
          break
        case 'i':
        case 'I':
          setShowInfo((prev) => !prev)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousemove', handleMouseMove)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [handleNext, handlePrev, onClose, handleMouseMove])

  if (!currentImage) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex select-none overflow-hidden animate-in fade-in duration-300">
      {/* Background Dimmer / Image Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative cursor-pointer"
        onClick={() => onImageClick(currentIndex)}
      >
        <img
          key={currentImage.filepath}
          src={`media://${encodeURI(currentImage.filepath.replace(/\\/g, '/'))}`}
          className="max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-500 animate-in fade-in zoom-in-95 duration-500"
          alt=""
        />

        {/* Top bar (filename & Close) */}
        <div
          className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center transition-all duration-300 z-10 ${
            isControlsVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-white text-sm font-bold truncate pr-4 max-w-[70%]">
            {currentImage.filepath.split(/[\\\/]/).pop()}
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-gray-900/60 hover:bg-gray-800 border border-white/10 rounded-full text-white transition-all active:scale-95"
            title={t('slideshow.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Left Arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handlePrev()
          }}
          className={`absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 border border-white/5 text-white rounded-full transition-all duration-300 z-10 ${
            isControlsVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
          }`}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          className={`absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 border border-white/5 text-white rounded-full transition-all duration-300 z-10 ${
            isControlsVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
          }`}
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Info panel in corner */}
        {showInfo && (
          <div
            className="absolute bottom-28 left-6 p-4 bg-gray-950/80 backdrop-blur-md rounded-2xl border border-white/10 text-white max-w-sm z-10 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-2">
              {t('viewer.fileInfo')}
            </h4>
            <div className="space-y-1 text-xs text-gray-300">
              <p className="truncate">
                <span className="text-gray-500 font-medium">Path:</span> {currentImage.filepath}
              </p>
              {metadata && (
                <>
                  <p>
                    <span className="text-gray-500 font-medium">Resolution:</span> {metadata.width}{' '}
                    x {metadata.height}
                  </p>
                  <p>
                    <span className="text-gray-500 font-medium">Format:</span> {metadata.format}
                  </p>
                  <p>
                    <span className="text-gray-500 font-medium">Size:</span>{' '}
                    {(metadata.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div
          className={`absolute bottom-6 left-1/2 -translate-x-1/2 p-4 bg-gray-950/90 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-6 shadow-2xl transition-all duration-300 z-20 ${
            isControlsVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all active:scale-95"
            title={isPlaying ? t('slideshow.pause') : t('slideshow.play')}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white text-white" />
            )}
          </button>

          {/* Shuffle Mode */}
          <button
            onClick={() => setPlayOrder((prev) => (prev === 'normal' ? 'random' : 'normal'))}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
              playOrder === 'random'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : 'text-gray-400 border-white/5 hover:bg-white/5'
            }`}
            title={t('slideshow.order')}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Loop Mode */}
          <button
            onClick={() => setIsLoop(!isLoop)}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
              isLoop
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : 'text-gray-400 border-white/5 hover:bg-white/5'
            }`}
            title={isLoop ? t('slideshow.loopOn') : t('slideshow.loopOff')}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-white/10" />

          {/* Interval setting */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <select
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              className="bg-gray-900 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {[3, 5, 10, 15, 30].map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Toggle Info */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
              showInfo
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                : 'text-gray-400 border-white/5 hover:bg-white/5'
            }`}
            title={t('slideshow.info')}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar at the very bottom */}
        {isPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
            <div
              className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
