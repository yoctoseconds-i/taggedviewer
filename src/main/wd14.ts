import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, readFileSync, unlinkSync, statSync } from 'fs'
import { get } from 'https'

let onnx: any = null
let Jimp: any = null
let session: any = null
let tags: string[] = []

function getModelPaths() {
    const dir = join(app.getPath('userData'), 'models')
    return {
        dir,
        model: join(dir, 'wd-v1-4-convnext-tagger-v2.onnx'),
        tags: join(dir, 'selected_tags.csv')
    }
}

const MODEL_URL = 'https://huggingface.co/SmilingWolf/wd-v1-4-convnext-tagger-v2/resolve/main/model.onnx'
const TAGS_URL = 'https://huggingface.co/SmilingWolf/wd-v1-4-convnext-tagger-v2/resolve/main/selected_tags.csv'

/**
 * Downloads a file, supporting recursive HTTP redirects and resolving relative URLs.
 */
async function downloadFile(urlStr: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        get(urlStr, (response) => {
            // Handle Redirects (301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
                const targetUrl = new URL(response.headers.location, urlStr).toString()
                return downloadFile(targetUrl, dest).then(resolve).catch(reject)
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${urlStr}: ${response.statusCode}`))
                return
            }

            const file = createWriteStream(dest)
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve()
            })
            file.on('error', (err) => {
                try { unlinkSync(dest) } catch { }
                reject(err)
            })
        }).on('error', (err) => {
            try { unlinkSync(dest) } catch { }
            reject(err)
        })
    })
}

async function loadEngine() {
    if (onnx && Jimp) return
    try {
        // @ts-ignore
        onnx = require('onnxruntime-node')
        // @ts-ignore
        const jimpPkg = require('jimp')
        Jimp = jimpPkg.Jimp || jimpPkg
    } catch (e) {
        // @ts-ignore
        const onnxMod = await import('onnxruntime-node')
        onnx = onnxMod.default || onnxMod
        // @ts-ignore
        const jimpMod = await import('jimp')
        Jimp = jimpMod.Jimp || jimpMod.default || jimpMod
    }
}

async function loadModel() {
    await loadEngine()
    if (session) return session

    const paths = getModelPaths()
    if (!existsSync(paths.dir)) mkdirSync(paths.dir, { recursive: true })

    // Check for corrupt/incomplete files (Model is ~80MB, Tags are ~300KB)
    if (existsSync(paths.model) && statSync(paths.model).size < 200 * 1024) {
        try { unlinkSync(paths.model) } catch { }
    }
    if (existsSync(paths.tags) && statSync(paths.tags).size < 10 * 1024) {
        try { unlinkSync(paths.tags) } catch { }
    }

    if (!existsSync(paths.model)) {
        console.log(`[WD14] Downloading model...`)
        await downloadFile(MODEL_URL, paths.model)
    }
    if (!existsSync(paths.tags)) {
        console.log(`[WD14] Downloading tags...`)
        await downloadFile(TAGS_URL, paths.tags)
    }

    const csv = readFileSync(paths.tags, 'utf-8')
    const lines = csv.split('\n')
    tags = lines.map(line => {
        const parts = line.split(',')
        if (parts.length < 2) return null
        return parts[1]
    }).filter((t): t is string => !!t && t !== 'name')

    try {
        const options: any = {
            executionProviders: ['cpu'],
            logSeverityLevel: 3
        }
        session = await onnx.InferenceSession.create(paths.model, options)
        console.log('[WD14] InferenceSession created successfully.')
    } catch (err) {
        console.error('[WD14] Failed to create InferenceSession. Likely corrupt model file.', err)
        throw err
    }
    return session
}

export async function tagImageWD14(imagePath: string): Promise<string[]> {
    try {
        const sess = await loadModel()
        const image = await Jimp.read(imagePath)

        const size = 448
        // @ts-ignore
        if (typeof image.resize === 'function') {
            // Jimp v1.6.0 uses Zod for validation and requires an options object
            image.resize({ w: size, h: size })
        } else {
            throw new Error('Jimp object missing resize method')
        }

        const p = image.bitmap.data
        const floatData = new Float32Array(1 * size * size * 3)

        let i = 0
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4
                // BGR Order
                floatData[i++] = p[idx + 2] // B
                floatData[i++] = p[idx + 1] // G
                floatData[i++] = p[idx]     // R
            }
        }

        const inputTensor = new onnx.Tensor('float32', floatData, [1, size, size, 3])
        const feeds = { [sess.inputNames[0]]: inputTensor }
        const results = await sess.run(feeds)
        const output = results[sess.outputNames[0]].data as Float32Array

        const threshold = 0.35
        const finalTags: string[] = []
        for (let j = 0; j < output.length; j++) {
            if (output[j] > threshold && tags[j]) {
                finalTags.push(tags[j])
            }
        }

        return finalTags
    } catch (e) {
        console.error('[WD14] Inference Error:', e)
        return []
    }
}
