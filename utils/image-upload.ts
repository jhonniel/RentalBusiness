export const IMAGE_UPLOAD_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp'
export const IMAGE_UPLOAD_SOURCE_MAX_BYTES = 15 * 1024 * 1024
export const IMAGE_STORED_MAX_BYTES = 2 * 1024 * 1024
export const IMAGE_UPLOAD_HELP = 'JPG, PNG, WebP, or HEIC up to 15 MB. Photos are compressed to JPEG before they are stored.'

export function isImageUploadType(value?: string | null): boolean {
  return Boolean(value && IMAGE_UPLOAD_TYPES.includes(value.toLowerCase() as typeof IMAGE_UPLOAD_TYPES[number]))
}

export function inferImageUploadType(file: { type?: string, filename?: string }) {
  const type = file.type?.toLowerCase()
  if (type === 'image/jpg') {
    return 'image/jpeg'
  }
  if (isImageUploadType(type)) {
    return type
  }

  const name = (file.filename || '').toLowerCase()
  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    return 'image/heic'
  }
  if (name.endsWith('.png')) {
    return 'image/png'
  }
  if (name.endsWith('.webp')) {
    return 'image/webp'
  }
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg'
  }

  return type
}
