import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, readFileSync, unlinkSync } from 'fs'
import { get } from 'https'

export async function startWorkerMode() {
    // parentPort is available in UtilityProcess, process is available in normal fork
    const port = (process as any).parentPort || process

    function sendMessage(p: any, msg: any) {
        if (p.postMessage) p.postMessage(msg)
        else if (p.send) p.send(msg)
    }

    if (!port.on) {
        console.error('[Worker] No communication port found. This script should be run as a utilityProcess or fork.')
        process.exit(1)
    }

    if (port.start) port.start()

    let onnx: any = null
    let sharp: any = null
    let session: any = null
    let tags: string[] = []

    const MODEL_URL = 'https://huggingface.co/SmilingWolf/wd-v1-4-convnext-tagger-v2/resolve/main/model.onnx'
    const TAGS_URL = 'https://huggingface.co/SmilingWolf/wd-v1-4-convnext-tagger-v2/resolve/main/selected_tags.csv'

    async function downloadFile(urlStr: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            get(urlStr, (response) => {
                if ([301, 302, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
                    const targetUrl = new URL(response.headers.location, urlStr).toString()
                    return downloadFile(targetUrl, dest).then(resolve).catch(reject)
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download ${urlStr}: ${response.statusCode}`))
                    return
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10)
                let downloadedSize = 0
                let lastLoggedPercent = -1

                const file = createWriteStream(dest)
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length
                    if (totalSize > 0) {
                        const percent = Math.floor((downloadedSize / totalSize) * 100)
                        if (percent % 10 === 0 && percent !== lastLoggedPercent) {
                            console.log(`[Worker] Downloading... ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`)
                            lastLoggedPercent = percent
                        }
                    }
                })

                response.pipe(file)
                file.on('finish', () => { file.close(); resolve() })
                file.on('error', (err) => { try { unlinkSync(dest) } catch { }; reject(err) })
            }).on('error', (err) => { try { unlinkSync(dest) } catch { }; reject(err) })
        })
    }

    async function loadModel(userDataPath: string) {
        if (!onnx) {
            console.log('[Worker] Loading onnxruntime-node...')
            onnx = require('onnxruntime-node')
        }
        if (!sharp) {
            console.log('[Worker] Loading sharp...')
            sharp = require('sharp')
        }
        if (session) return session

        const dir = join(userDataPath, 'models')
        const paths = { dir, model: join(dir, 'wd-v1-4-convnext-tagger-v2.onnx'), tags: join(dir, 'selected_tags.csv') }
        if (!existsSync(paths.dir)) {
            console.log(`[Worker] Creating directory: ${paths.dir}`)
            mkdirSync(paths.dir, { recursive: true })
        }

        if (!existsSync(paths.model)) {
            console.log(`[Worker] Model missing. Starting download from: ${MODEL_URL}`)
            await downloadFile(MODEL_URL, paths.model)
            console.log(`[Worker] Model download complete: ${paths.model}`)
        }
        if (!existsSync(paths.tags)) {
            console.log(`[Worker] Tags CSV missing. Starting download from: ${TAGS_URL}`)
            await downloadFile(TAGS_URL, paths.tags)
            console.log(`[Worker] Tags CSV download complete.`)
        }

        if (!session) {
            console.log('[Worker] Initializing ONNX InferenceSession (this may take a few seconds)...')
            const csv = readFileSync(paths.tags, 'utf-8')
            tags = csv.split('\n').map(l => l.split(',')[1]).filter((t): t is string => !!t && t !== 'name')
            session = await onnx.InferenceSession.create(paths.model, {
                executionProviders: process.platform === 'win32' ? ['dml', 'cpu'] : ['cuda', 'cpu'],
                logSeverityLevel: 3
            })
            console.log('[Worker] ONNX InferenceSession ready.')
        }
        return session
    }

    port.on('message', async (event: any) => {
        // UtilityProcess (parentPort) provides an event-like object with .data
        // child_process.fork provides the message data directly
        const message = event && typeof event === 'object' && 'data' in event ? event.data : event

        if (!message) {
            console.log('[Worker] Received empty or invalid message:', event)
            return
        }

        const { type, payload, id } = message
        console.log(`[Worker] Received message type: ${type} (id: ${id})`)

        if (type === 'TAG_IMAGE') {
            try {
                const { imagePath, userDataPath } = payload
                console.log(`[Worker] Processing TAG_IMAGE for: ${imagePath}`)
                const sess = await loadModel(userDataPath)
                const size = 448
                console.log(`[Worker] Image preprocessing...`)
                const { data } = await sharp(imagePath).resize(size, size, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
                const floatData = new Float32Array(1 * size * size * 3)
                for (let i = 0; i < size * size; i++) {
                    floatData[i * 3] = data[i * 4 + 2]; floatData[i * 3 + 1] = data[i * 4 + 1]; floatData[i * 3 + 2] = data[i * 4]
                }
                console.log(`[Worker] Running inference...`)
                const results = await sess.run({ [sess.inputNames[0]]: new onnx.Tensor('float32', floatData, [1, size, size, 3]) })
                const output = results[sess.outputNames[0]].data as Float32Array
                const finalTags = []
                for (let j = 0; j < output.length; j++) if (output[j] > 0.35 && tags[j]) finalTags.push(tags[j])
                console.log(`[Worker] Done. Found ${finalTags.length} tags.`)
                sendMessage(port, { type: 'TAG_IMAGE_RESULT', payload: finalTags, id })
            } catch (err) {
                console.error('[Worker] Tagging error:', err)
                sendMessage(port, { type: 'TAG_IMAGE_RESULT', payload: [], id, error: String(err) })
            }
        } else if (type === 'SHUTDOWN') {
            console.log('[Worker] Shutting down...')
            process.exit(0)
        }
    })

    // Notify main process that we are ready
    sendMessage(port, { type: 'READY' })
    console.log('[Worker] Started and listening...')
}
