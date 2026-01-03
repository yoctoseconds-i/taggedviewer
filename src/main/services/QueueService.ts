import { BrowserWindow } from 'electron'
import { generateTags } from '../tagger'
import {
  getUnprocessedImages,
  getSettings,
  insertTag,
  getTag,
  linkImageTag,
  markImageProcessed,
} from '../db'

let queue: any[] = []
let currentTargetThreads = 2
let isProcessing = false

export const setTargetThreads = (count: number) => {
  currentTargetThreads = count
}

export const stopQueue = () => {
  currentTargetThreads = 0
  queue = []
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

    const startWorker = async (workerIndex: number) => {
      activeWorkers++
      console.log(`[QueueService] Worker ${workerIndex} started. Total active: ${activeWorkers}`)

      while (queue.length > 0) {
        if (win.isDestroyed()) break

        // If the user decreased threads, this worker might need to stop
        if (workerIndex >= currentTargetThreads) {
          console.log(
            `[QueueService] Worker ${workerIndex} stopping (threads reduced to ${currentTargetThreads})`
          )
          break
        }

        const image = queue.shift()
        if (!image) break

        try {
          const tags = await generateTags(image.filepath)
          const imageTags: any[] = []

          if (tags.length > 0) {
            for (const t of tags) {
              await insertTag.run({ name: t })
              const tagRow = await getTag.get({ name: t })
              if (tagRow) {
                await linkImageTag.run({ imageId: image.id, tagId: tagRow.id })
                imageTags.push(tagRow)
              }
            }
          }

          await markImageProcessed.run({ id: image.id })
          processedCount++

          if (!win.isDestroyed()) {
            win.webContents.send('scan:progress', {
              total: totalToProcess,
              current: processedCount,
              image: image,
              tags: imageTags,
            })
          }
        } catch (e) {
          console.error(`Error processing ${image.filepath}`, e)
        }
        await new Promise((r) => setTimeout(r, 10))
      }
      activeWorkers--
    }

    // Monitor for increases and initial start
    const workersPromise = new Promise<void>(async (resolve) => {
      while (true) {
        if (win.isDestroyed() || (queue.length === 0 && activeWorkers === 0)) {
          break
        }

        // If threads reduced to 0, stop the entire process
        if (currentTargetThreads === 0 && activeWorkers === 0) {
          break
        }

        // Spawn more workers if target increased
        if (activeWorkers < currentTargetThreads && queue.length > 0) {
          const diff = currentTargetThreads - activeWorkers
          for (let i = 0; i < diff; i++) {
            startWorker(activeWorkers)
          }
        }

        await new Promise((r) => setTimeout(r, 500))
      }
      resolve()
    })

    await workersPromise
    return { success: true, count: processedCount }
  } finally {
    isProcessing = false
  }
}
