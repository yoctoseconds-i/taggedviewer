import * as electron from 'electron'
import { join } from 'path'
import { fork } from 'child_process'

let worker: any = null
let idleTimer: NodeJS.Timeout | null = null
const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

let readyResolve: ((value: any) => void) | null = null
let readyPromise: Promise<any> | null = null
let isInitializing = false

interface Request {
  resolve: (value: string[]) => void
  reject: (reason?: any) => void
}
const pendingRequests = new Map<string, Request>()

async function spawnWorker() {
  if (worker && readyPromise) return readyPromise
  if (isInitializing) return readyPromise

  isInitializing = true
  readyPromise = new Promise((resolve) => {
    readyResolve = resolve
  })

  const scriptPath = electron.app?.isPackaged
    ? join(__dirname, 'index.js')
    : join(process.cwd(), 'out', 'main', 'index.js')

  console.log(`[WD14 Manager] Spawning self as worker: ${scriptPath}`)

  const args = ['--worker-mode']

  if (electron.utilityProcess) {
    worker = electron.utilityProcess.fork(scriptPath, args, {
      stdio: 'inherit',
    })
  } else {
    // Fallback for test environment where utilityProcess is not available
    console.log('[WD14 Manager] utilityProcess not available, falling back to child_process.fork')
    worker = fork(scriptPath, args, {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
  }

  const onMessage = (message: any) => {
    const { type, payload, id } = message
    if (type === 'TAG_IMAGE_RESULT') {
      const req = pendingRequests.get(id)
      if (req) {
        console.log(`[WD14 Manager] Received result for id: ${id} (${payload.length} tags)`)
        req.resolve(payload)
        pendingRequests.delete(id)
      }
    } else if (type === 'READY') {
      console.log('[WD14 Manager] Worker is READY')
      isInitializing = false
      if (readyResolve) readyResolve(worker)
    }
    resetIdleTimer()
  }

  if (worker.on) {
    worker.on('message', onMessage)
    worker.on('error', (err: any) => {
      console.error('[WD14 Manager] Worker error:', err)
    })
    worker.on('exit', (code: number) => {
      console.log(`[WD14 Manager] Worker exited with code: ${code}`)
      worker = null
      readyPromise = null
      isInitializing = false
      pendingRequests.forEach((req) => req.reject(new Error(`Worker exited with code ${code}`)))
      pendingRequests.clear()
    })
  }

  return readyPromise
}

function sendMessage(w: any, message: any) {
  if (w.postMessage) w.postMessage(message)
  else if (w.send) w.send(message)
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (worker && pendingRequests.size === 0) {
      console.log('[WD14 Manager] Worker idle for 5 mins, terminating...')
      worker.kill()
      worker = null
      readyPromise = null
    }
  }, IDLE_TIMEOUT)
}

export async function tagImageWD14(
  imagePath: string,
  customUserDataPath?: string
): Promise<string[]> {
  const w = await spawnWorker()
  const id = Math.random().toString(36).substring(7)
  const userDataPath =
    customUserDataPath ||
    (electron.app ? electron.app.getPath('userData') : join(process.cwd(), 'out', 'test-user-data'))

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    console.log(`[WD14 Manager] Sending TAG_IMAGE for: ${imagePath} (id: ${id})`)
    sendMessage(w, {
      type: 'TAG_IMAGE',
      payload: { imagePath, userDataPath },
      id,
    })
    resetIdleTimer()
  })
}
