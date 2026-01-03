import { _electron as electron } from '@playwright/test'
import { test, expect } from '@playwright/test'

test('should load images successfully', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    executablePath: process.platform === 'win32' ? 'node_modules/.bin/electron.cmd' : undefined,
  })

  const window = await electronApp.firstWindow()

  // Wait for the app to load images
  await window.waitForSelector('img', { timeout: 15000 }).catch(() => {})

  // Small delay for rendering
  await window.waitForTimeout(2000)

  const images = await window.locator('img').all()
  console.log(`Found ${images.length} images`)

  let mediaImageCount = 0
  for (const img of images) {
    const src = await img.getAttribute('src')
    if (src && src.startsWith('media://')) {
      mediaImageCount++
      const imgInfo = await img.evaluate((node: HTMLImageElement) => {
        return {
          complete: node.complete,
          naturalWidth: node.naturalWidth,
          src: node.src,
        }
      })

      console.log(`Checking image: ${imgInfo.src} - Width: ${imgInfo.naturalWidth}`)
      expect(imgInfo.naturalWidth, `Image failed to load (Width 0): ${src}`).toBeGreaterThan(0)
    }
  }

  console.log(`Verified ${mediaImageCount} media images`)
  await electronApp.close()
})
