import { BrowserWindow } from 'electron'
import { generateTags } from '../tagger'
import { getUnprocessedImages, getSettings, processImageResultsBulk } from '../db'

let currentTargetThreads = 2
let isProcessing = false

export const setTargetThreads = (count: number) => {
  currentTargetThreads = count
}

export const stopQueue = () => {
  currentTargetThreads = 0
}

export const getProcessingStatus = () => isProcessing

export async function processQueue(win: BrowserWindow) {
  if (isProcessing) return { success: true, alreadyRunning: true }
  isProcessing = true

  try {
    const queue = await getUnprocessedImages.get()
    const settings = await getSettings.get()
    currentTargetThreads = settings.threadCount || 2

    console.log(
      `[QueueService] Found ${queue.length} unprocessed images. Initial Threads: ${currentTargetThreads}`
    )
    let processedCount = 0
    const totalToProcess = queue.length
    let activeWorkers = 0

    if (totalToProcess === 0) {
      isProcessing = false
      return { success: true, count: 0 }
    }

    if (!win.isDestroyed()) {
      win.webContents.send('scan:progress', { total: totalToProcess, current: 0 })
    }

    // Results buffering
    let resultsBuffer: { imageId: number; tagNames: string[] }[] = []
    let lastProgressUpdate = 0
    const PROGRESS_THROTTLE_MS = 200 // Update UI at most 5 times per second

    const flushResults = async () => {
      if (resultsBuffer.length === 0) return
      const batch = [...resultsBuffer]
      resultsBuffer = []
      await processImageResultsBulk.run(batch)
    }

    const startWorker = async (workerIndex: number) => {
      activeWorkers++
      console.log(`[QueueService] Worker ${workerIndex} started.`)

      while (queue.length > 0) {
        if (win.isDestroyed() || currentTargetThreads === 0) break
        if (workerIndex >= currentTargetThreads) break

        const image = queue.shift()
        if (!image) break

        try {
          const tags = await generateTags(image.filepath)
          resultsBuffer.push({ imageId: image.id, tagNames: tags })
          processedCount++

          // Throttled notification
          const now = Date.now()
          if (now - lastProgressUpdate > PROGRESS_THROTTLE_MS || queue.length === 0) {
            lastProgressUpdate = now
            if (!win.isDestroyed()) {
              win.webContents.send('scan:progress', {
                total: totalToProcess,
                current: processedCount,
                image: image,
                // Resulting tags might not be in DB yet, but for UI feedback it's usually okay
                // or we can omit them and let UI refresh after batch.
                // For simplicity, we send current image and its tags.
                tags: tags.map((t) => ({ name: t })),
              })
            }
          }

          // Periodic flush
          if (resultsBuffer.length >= 10) {
            await flushResults()
          }
        } catch (e) {
          console.error(`Error processing ${image.filepath}`, e)
        }
        await new Promise((r) => setTimeout(r, 10))
      }
      activeWorkers--
    }

    const workersPromise = new Promise<void>(async (resolve) => {
      while (true) {
        if (
          win.isDestroyed() ||
          (queue.length === 0 && activeWorkers === 0) ||
          currentTargetThreads === 0
        ) {
          break
        }

        if (activeWorkers < currentTargetThreads && queue.length > 0) {
          const diff = currentTargetThreads - activeWorkers
          for (let i = 0; i < diff; i++) {
            startWorker(activeWorkers)
          }
        }

        // Final flush if close to end
        if (resultsBuffer.length > 0) {
          await flushResults()
        }

        await new Promise((r) => setTimeout(r, 500))
      }
      await flushResults() // Last one
      resolve()
    })

    await workersPromise
    return { success: true, count: processedCount }
  } finally {
    isProcessing = false
  }
}
