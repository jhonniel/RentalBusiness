import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { addProductImages } from '../../../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-catalog:${profile.uuid}`, 40, 60_000)

  const form = await readMultipartFormData(event)
  const files = form?.filter(part => part.name === 'file' && part.data) ?? []
  const alt = form?.find(part => part.name === 'alt')?.data.toString() || ''

  if (!files.length) {
    throw new AppError('Choose one or more images to upload.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (files.length > 12) {
    throw new AppError('Upload up to 12 images at a time.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return addProductImages(event, client, uuid, files, alt)
})
