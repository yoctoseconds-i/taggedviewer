import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { scanDirectory } from './scanner'
import { insertImage, getAllImages, insertTag, linkImageTag, getAllTags, getImage, getTag, getImagesByTag, clearDatabase, getUnprocessedImages, markImageProcessed, resetProcessed, toggleFavoriteTag, getTagsForImage } from './db'
import { generateTags } from './tagger'

export function setupIPC(mainWindow: BrowserWindow) {
    ipcMain.handle('db:resetProcessed', async () => {
        await resetProcessed.run()
        return true
    })
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        })
        if (canceled) return null
        return filePaths[0]
    })

    ipcMain.handle('scan:start', async (_, dirPath: string) => {
        console.log(`Starting scan for ${dirPath}`)
        const files = scanDirectory(dirPath)

        // Phase 1: Registration
        let registered = 0
        for (const file of files) {
            if (mainWindow.isDestroyed()) return { success: false, count: 0 }
            await insertImage.run({ filepath: file })
            registered++
            if (registered % 50 === 0) {
                mainWindow.webContents.send('scan:progress', { total: files.length, current: registered })
            }
        }

        // Phase 2: Processing Queue
        return await processQueue(mainWindow)
    })

    ipcMain.handle('scan:resume', async () => {
        return await processQueue(mainWindow)
    })

    ipcMain.handle('db:getImages', async () => {
        return await getAllImages.all()
    })

    ipcMain.handle('db:getTags', async () => {
        return await getAllTags.all()
    })

    ipcMain.handle('db:getImagesByTag', async (_, tagName: string) => {
        return await getImagesByTag.get({ tagName })
    })

    ipcMain.handle('db:clear', async () => {
        await clearDatabase.run()
        return true
    })

    ipcMain.handle('db:toggleFavoriteTag', async (_, id: number) => {
        return await toggleFavoriteTag.run({ id })
    })

    ipcMain.handle('db:getTagsForImage', async (_, imageId: number) => {
        return await getTagsForImage.get({ imageId })
    })

    ipcMain.handle('shell:showItemInFolder', async (_, filepath: string) => {
        shell.showItemInFolder(filepath)
        return true
    })
}

async function processQueue(win: BrowserWindow) {
    // @ts-ignore
    const queue = await getUnprocessedImages.get()
    console.log(`[IPC] processQueue found ${queue.length} unprocessed images.`)
    let processedCount = 0
    const totalToProcess = queue.length

    // If nothing to process, we can return early or just return count 0
    if (totalToProcess === 0) return { success: true, count: 0 }

    // Send initial progress for processing phase
    if (!win.isDestroyed()) {
        win.webContents.send('scan:progress', { total: totalToProcess, current: 0 })
    }

    for (const image of queue) {
        if (win.isDestroyed()) break

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

            // Mark as processed only after successful tagging
            // @ts-ignore
            await markImageProcessed.run({ id: image.id })

            processedCount++
            if (!win.isDestroyed()) {
                win.webContents.send('scan:progress', {
                    total: totalToProcess,
                    current: processedCount,
                    image: image,
                    tags: imageTags
                })
            }
        } catch (e) {
            console.error(`Error processing ${image.filepath}`, e)
        }

        // Small delay to prevent UI freezing
        await new Promise(r => setTimeout(r, 10))
    }

    return { success: true, count: processedCount }
}
