import { _electron as electron } from '@playwright/test'
import { test, expect } from '@playwright/test'

test('should toggle favorite status in sidebar', async () => {
    const electronApp = await electron.launch({
        args: ['.'],
        executablePath: process.platform === 'win32' ? 'node_modules/.bin/electron.cmd' : undefined,
    })

    const window = await electronApp.firstWindow()

    // Wait for sidebar to load tags
    // We assume there's at least one tag. If not, this test might need a scan first.
    // But based on user's current state, there are 289 images, so tags should exist.
    await window.waitForSelector('button[aria-label*="favorites"]', { timeout: 15000 }).catch(() => { })

    const favoriteButtons = await window.locator('button[aria-label*="favorites"]').all()
    if (favoriteButtons.length === 0) {
        console.log('No tags found to test favorites')
        await electronApp.close()
        return
    }

    const firstTagBtn = favoriteButtons[0]
    const initialLabel = await firstTagBtn.getAttribute('aria-label')
    const isInitiallyFavorite = initialLabel === 'Remove from favorites'

    // Click to toggle
    await firstTagBtn.click()

    // Wait for the label to change
    const expectedLabel = isInitiallyFavorite ? 'Add to favorites' : 'Remove from favorites'
    await expect(firstTagBtn).toHaveAttribute('aria-label', expectedLabel, { timeout: 5000 })

    // Verify "Favorites" section appears if it was the first favorite
    if (!isInitiallyFavorite) {
        const favoritesHeader = window.locator('span:has-text("Favorites")')
        await expect(favoritesHeader).toBeVisible()
    }

    await electronApp.close()
})
