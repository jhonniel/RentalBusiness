import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { AppError } from '../../server/utils/errors'
import { compressImageForStorage } from '../../server/utils/image-compress'

describe('image compression', () => {
  it('compresses PNG photos to JPEG before storage', async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: { r: 180, g: 40, b: 40 },
      },
    })
      .png()
      .toBuffer()

    const compressed = await compressImageForStorage({
      data: source,
      type: 'image/png',
      filename: 'product.png',
    })

    expect(compressed.type).toBe('image/jpeg')
    expect(compressed.extension).toBe('jpg')
    expect(compressed.data.byteLength).toBeLessThan(source.byteLength)
    expect((await sharp(compressed.data).metadata()).format).toBe('jpeg')
  })

  it('rejects files that are not images', async () => {
    await expect(compressImageForStorage({
      data: Buffer.from('%PDF-1.4'),
      type: 'application/pdf',
      filename: 'id.pdf',
    })).rejects.toBeInstanceOf(AppError)
  })
})
