import { addonInputSchema } from '../../../utils/addon-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { saveAddon } from '../../services/addon.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-addons:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(addonInputSchema, await readBody(event))
  return saveAddon(event, client, input)
})
