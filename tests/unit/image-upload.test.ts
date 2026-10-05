import { describe, expect, it } from 'vitest'
import {
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  inferImageUploadType,
  isImageUploadType,
} from '../../utils/image-upload'

describe('image upload types', () => {
  it('accepts iPhone HEIC photos and common web formats', () => {
    expect(isImageUploadType('image/heic')).toBe(true)
    expect(isImageUploadType('image/heif')).toBe(true)
    expect(isImageUploadType('image/jpeg')).toBe(true)
    expect(isImageUploadType('application/pdf')).toBe(false)
    expect(IMAGE_UPLOAD_SOURCE_MAX_BYTES).toBe(15 * 1024 * 1024)
  })

  it('infers HEIC from the filename when the browser omits a type', () => {
    expect(inferImageUploadType({ filename: 'IMG_1234.HEIC' })).toBe('image/heic')
    expect(inferImageUploadType({ type: 'image/jpg', filename: 'id.jpg' })).toBe('image/jpeg')
  })
})
