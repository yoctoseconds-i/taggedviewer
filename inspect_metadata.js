const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Replace with a path to an image that definitely has prompts
const testFile = process.argv[2]

if (!testFile) {
  console.error('Please provide a file path')
  process.exit(1)
}

async function inspectMetadata() {
  try {
    const s = sharp(testFile)
    const metadata = await s.metadata()
    console.log('--- BASIC METADATA ---')
    console.log('Format:', metadata.format)
    console.log('Text:', JSON.stringify(metadata.text, null, 2))

    // Check for Exif
    if (metadata.exif) {
      console.log('--- EXIF FOUND ---')
      // sharp's metadata.exif is a Buffer. We might need a parser to see strings inside it.
      // But often it's just raw bytes.
      console.log('Exif length:', metadata.exif.length)
    }

    // Some tools put prompts in specific PNG chunks or JPEG COM markers.
    // Sharp's .metadata().text should catch PNG tEXt/zTXt.
    // Let's try to read the file raw for signatures if it's a JPEG and sharp didn't find "text".
    if (metadata.format === 'jpeg' && !metadata.text) {
      const buf = fs.readFileSync(testFile)
      // Look for "parameters" or "UserComment"
      const str = buf.toString('utf8')
      if (str.includes('parameters')) {
        console.log('Found "parameters" in raw buffer (likely A1111 JPEG)')
      }
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

inspectMetadata()
