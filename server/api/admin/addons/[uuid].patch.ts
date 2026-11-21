import { addonInputSchema } from '../../../../utils/addon-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { assertRateLimit } from '../../../utils/rate-limit'
import { saveAddon } from '../../../services/addon.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-addons:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(addonInputSchema, await readBody(event))
  return saveAddon(event, client, input, uuid)
})
