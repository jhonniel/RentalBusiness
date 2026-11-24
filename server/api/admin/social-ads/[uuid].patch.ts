import { socialAdInputSchema } from '../../../../utils/social-link-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { isUuid } from '../../../../utils/slug'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { saveSocialAd } from '../../../services/social-link.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-social-ads:${profile.uuid}`, 40, 60_000)
  const uuid = getRouterParam(event, 'uuid') || ''
  if (!isUuid(uuid)) {
    throw new AppError('Social ad not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const input = parseWithSchema(socialAdInputSchema, await readBody(event))
  return saveSocialAd(event, client, input, uuid)
})
