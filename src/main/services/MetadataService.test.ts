import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import sharp from 'sharp'
import { getImageMetadata } from './MetadataService'

vi.mock('fs')
vi.mock('sharp')

describe('MetadataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from(''))
  })

  it('should return null if sharp fails', async () => {
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockRejectedValue(new Error('Failed')),
    } as any)

    const result = await getImageMetadata('test.png')
    expect(result).toBeNull()
  })

  it('should extract metadata from sharp text', async () => {
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockResolvedValue({
        format: 'png',
        text: { parameters: 'prompt text' },
      }),
    } as any)

    const result = await getImageMetadata('test.png')
    expect(result?.text.parameters).toBe('prompt text')
  })

  it('should fallback to manual PNG parsing if sharp text is empty', async () => {
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockResolvedValue({
        format: 'png',
        text: {},
      }),
    } as any)

    // Mock a PNG buffer with a tEXt chunk
    const key = 'parameters'
    const val = 'manual prompt'
    const data = Buffer.concat([Buffer.from(key), Buffer.from([0]), Buffer.from(val)])
    const chunk = Buffer.alloc(4 + 4 + data.length + 4)
    chunk.writeUInt32BE(data.length, 0)
    chunk.write('tEXt', 4)
    data.copy(chunk, 8)

    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const fullBuf = Buffer.concat([pngHeader, chunk])

    vi.spyOn(fs, 'readFileSync').mockReturnValue(fullBuf)

    const result = await getImageMetadata('test.png')
    expect(result?.text.parameters).toBe('manual prompt')
  })

  it('should fallback to string scan if no chunks found', async () => {
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockResolvedValue({
        format: 'jpeg',
        text: {},
      }),
    } as any)

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      Buffer.from('...some data... parameters: raw prompt ...')
    )

    const result = await getImageMetadata('test.jpg')
    expect(result?.text.parameters).toContain('Detected potential prompt')
  })
})
