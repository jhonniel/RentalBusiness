const MAX_EDGE = 1920
const JPEG_QUALITY = 0.78

export async function compressImageFileForUpload(file: File): Promise<File> {
  if (!import.meta.client || typeof createImageBitmap !== 'function') {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) {
      return file
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  }
  catch {
    return file
  }
}

export async function identityUploadFormData(input: {
  governmentId: File
  selfie: File
  extra?: Record<string, string>
}) {
  const body = new FormData()
  body.append('governmentId', await compressImageFileForUpload(input.governmentId))
  body.append('selfie', await compressImageFileForUpload(input.selfie))
  for (const [name, value] of Object.entries(input.extra || {})) {
    body.append(name, value)
  }
  return body
}
