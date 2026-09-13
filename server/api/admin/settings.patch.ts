import { businessSettingsInputSchema } from '../../../utils/settings-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { assertRateLimit } from '../../utils/rate-limit'
import { updateAdminSettings } from '../../services/settings.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-settings:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(businessSettingsInputSchema, await readBody(event))
  return updateAdminSettings(event, client, input)
})
