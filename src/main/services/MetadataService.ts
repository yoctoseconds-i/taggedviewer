import fs from 'fs'
import sharp from 'sharp'

export interface ImageMetadata {
  text: Record<string, string>
  hasExif?: boolean
}

export async function getImageMetadata(filepath: string): Promise<ImageMetadata | null> {
  try {
    const metadata = await sharp(filepath).metadata()
    const text = (metadata as any).text || {}

    const result: ImageMetadata = {
      text: text,
    }

    // If it's a PNG, manually parse chunks to find tEXt/iTXt
    if (metadata.format === 'png') {
      try {
        const buf = fs.readFileSync(filepath)
        let pos = 8 // Skip PNG header
        while (pos < buf.length - 12) {
          const length = buf.readUInt32BE(pos)
          const type = buf.toString('ascii', pos + 4, pos + 8)
          if (type === 'tEXt' || type === 'iTXt') {
            const data = buf.slice(pos + 8, pos + 8 + length)
            if (type === 'tEXt') {
              const nullPos = data.indexOf(0)
              if (nullPos !== -1) {
                const key = data.toString('utf8', 0, nullPos)
                const val = data.toString('utf8', nullPos + 1)
                result.text[key] = val
              }
            } else if (type === 'iTXt') {
              let p = 0
              const keywordNull = data.indexOf(0, p)
              if (keywordNull !== -1) {
                const key = data.toString('utf8', p, keywordNull)
                p = keywordNull + 1 + 2 // skip compression flag/method
                const langNull = data.indexOf(0, p)
                p = langNull + 1
                const transNull = data.indexOf(0, p)
                p = transNull + 1
                const val = data.toString('utf8', p)
                result.text[key] = val
              }
            }
          } else if (type === 'IEND') {
            break
          }
          pos += length + 12
        }
      } catch (e) {
        console.error('[MetadataService] PNG manual parse failed', e)
      }
    }

    // For JPEG or fallback, try raw buffer scan for keywords
    if (Object.keys(result.text).length === 0) {
      const buf = fs.readFileSync(filepath)
      const str = buf.toString('utf8')
      if (str.includes('parameters')) {
        result.text.parameters = 'Detected potential prompt data in file (parameters)'
      }
    }

    const hasContent = Object.keys(result.text).length > 0 || !!metadata.exif
    return hasContent ? result : null
  } catch (err) {
    console.error('[MetadataService] Failed to get metadata', err)
    return null
  }
}
