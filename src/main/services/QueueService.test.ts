import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processQueue, setTargetThreads } from './QueueService'
import * as db from '../db'
import * as tagger from '../tagger'
import { BrowserWindow } from 'electron'

vi.mock('../db', () => ({
  getUnprocessedImages: { get: vi.fn() },
  getSettings: { get: vi.fn() },
  processImageResultsBulk: { run: vi.fn() },
}))

vi.mock('../tagger', () => ({
  generateTags: vi.fn(),
}))

describe('QueueService', () => {
  let mockWin: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockWin = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        send: vi.fn(),
      },
    }
  })

  it('should process images in the queue and use bulk insertion', async () => {
    const mockImages = [
      { id: 1, filepath: 'test1.jpg' },
      { id: 2, filepath: 'test2.jpg' },
    ]
      ; (db.getUnprocessedImages.get as any).mockResolvedValue(mockImages)
      ; (db.getSettings.get as any).mockResolvedValue({ threadCount: 1 })
      ; (tagger.generateTags as any).mockResolvedValue(['tag1', 'tag2'])

    const result = await processQueue(mockWin as BrowserWindow)

    expect(result.success).toBe(true)
    expect(result.count).toBe(2)
    expect(tagger.generateTags).toHaveBeenCalledTimes(2)
    // processImageResultsBulk.run is called at least once (at the end of workersPromise)
    expect(db.processImageResultsBulk.run).toHaveBeenCalled()
    expect(mockWin.webContents.send).toHaveBeenCalledWith('scan:progress', expect.anything())
  })

  it('should stop when thread count is reduced', async () => {
    const mockImages = Array.from({ length: 10 }, (_, i) => ({ id: i, filepath: `test${i}.jpg` }))
      ; (db.getUnprocessedImages.get as any).mockResolvedValue(mockImages)
      ; (db.getSettings.get as any).mockResolvedValue({ threadCount: 2 })
      ; (tagger.generateTags as any).mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50))
        return ['tag']
      })

    // Start processing
    const processingPromise = processQueue(mockWin as BrowserWindow)

    // Immediately reduce threads to 0 (or smaller than current active)
    await new Promise((r) => setTimeout(r, 20))
    setTargetThreads(0)

    const result = await processingPromise
    // It should have processed some but stopped
    expect(result.count).toBeLessThan(10)
  })
})
