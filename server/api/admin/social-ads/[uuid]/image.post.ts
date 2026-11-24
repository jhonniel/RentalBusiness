import { isUuid } from '../../../../../utils/slug'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { uploadSocialAdImage } from '../../../../services/social-link.service'
import type { UploadPart } from '../../../../utils/image-compress'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-social-ads:${profile.uuid}`, 40, 60_000)
  const uuid = getRouterParam(event, 'uuid') || ''
  if (!isUuid(uuid)) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')
  if (!file?.data) {
    throw new AppError('Upload a promo image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return uploadSocialAdImage(event, client, uuid, file as UploadPart)
})
