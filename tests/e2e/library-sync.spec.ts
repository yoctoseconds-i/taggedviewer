import { _electron as electron } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

test('library manual sync should work', async () => {
  // Setup a temporary library folder
  const testLibDir = join(tmpdir(), `taggedviewer-test-lib-${Date.now()}`)
  await fs.mkdir(testLibDir, { recursive: true })

  const testImg1 = join(testLibDir, 'image1.jpg')
  await fs.writeFile(testImg1, 'fake jpg data')

  const electronApp = await electron.launch({
    args: ['.'],
    executablePath: process.platform === 'win32' ? 'node_modules/.bin/electron.cmd' : undefined,
  })

  const window = await electronApp.firstWindow()

  try {
    // 1. Open settings
    await window.click('button:has-text("Settings"), button:has-text("設定")')

    // 2. Check if manual sync buttons are visible (supporting both EN and JA)
    const syncButton = window.locator(
      'button:has-text("Sync Library"), button:has-text("ライブラリの同期")'
    )
    await expect(syncButton).toBeVisible()

    const rescanButton = window.locator(
      'button:has-text("Force Rescan"), button:has-text("強制再読み込み")'
    )
    await expect(rescanButton).toBeVisible()

    // 3. Trigger sync - it shouldn't crash with SqliteError
    await syncButton.click()

    // Give it a moment to run
    await window.waitForTimeout(2000)

    // Ensure the app is still responsive (can close settings)
    await window.click(
      'button:has(svg.lucide-x), button:has-text("Cancel"), button:has-text("キャンセル")'
    )
  } finally {
    await electronApp.close()
    await fs.rm(testLibDir, { recursive: true, force: true }).catch(() => {})
  }
})
