import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { assertRateLimit } from '../../../utils/rate-limit'
import { addMaintenanceImages } from '../../../services/maintenance.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-maintenance:${profile.uuid}`, 40, 60_000)

  const form = await readMultipartFormData(event)
  const files = form?.filter(part => part.name === 'file' && part.data) ?? []
  const alt = form?.find(part => part.name === 'alt')?.data.toString() || ''

  if (!files.length) {
    throw new AppError('Choose one or more images to upload.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return addMaintenanceImages(event, client, files, alt)
})
