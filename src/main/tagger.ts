import { tagImageWD14 } from './wd14'

/**
 * Generates tags for an image using the local WD14 Tagger (ONNX).
 * Fallback to Ollama has been removed to optimize for speed and privacy.
 */
export async function generateTags(imagePath: string): Promise<string[]> {
    try {
        // console.log(`[Tagger] Starting WD14 inference for: ${imagePath}`)
        const tags = await tagImageWD14(imagePath)

        if (tags && tags.length > 0) {
            return tags
        }

        return []
    } catch (e) {
        console.error('[Tagger] WD14 tagging failed:', e)
        return []
    }
}
