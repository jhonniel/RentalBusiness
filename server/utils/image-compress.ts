import sharp from 'sharp'
import {
  IMAGE_STORED_MAX_BYTES,
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  inferImageUploadType,
  isImageUploadType,
} from '../../utils/image-upload'
import { AppError, ERROR_CODES } from './errors'

export type UploadPart = { filename?: string, type?: string, data: Buffer }

export interface CompressedImage {
  data: Buffer
  type: 'image/jpeg'
  extension: 'jpg'
}

export interface CompressImageOptions {
  label?: string
  maxEdge?: number
  quality?: number
}

export async function compressImageForStorage(
  file: UploadPart | undefined,
  options: CompressImageOptions = {},
): Promise<CompressedImage> {
  const label = options.label || 'image'
  if (!file?.data?.byteLength) {
    throw new AppError(`Upload a ${label}.`, 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const type = inferImageUploadType(file)
  if (!isImageUploadType(type)) {
    throw new AppError('Upload a JPG, PNG, WebP, or HEIC image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (file.data.byteLength > IMAGE_UPLOAD_SOURCE_MAX_BYTES) {
    throw new AppError('Images must be 15 MB or smaller before compression.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  try {
    let quality = options.quality ?? 78
    const maxEdge = options.maxEdge ?? 1920
    let data = await sharp(file.data, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    while (data.byteLength > IMAGE_STORED_MAX_BYTES && quality > 42) {
      quality -= 12
      data = await sharp(data)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
    }

    if (data.byteLength > IMAGE_STORED_MAX_BYTES) {
      throw new AppError('We could not compress that image enough to store it.', 422, ERROR_CODES.VALIDATION_ERROR)
    }

    return { data, type: 'image/jpeg', extension: 'jpg' }
  }
  catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(
      'We could not read that image. Try a JPG, PNG, or WebP photo.',
      422,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }
}
