import { socialAdInputSchema } from '../../../utils/social-link-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { saveSocialAd } from '../../services/social-link.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-social-ads:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(socialAdInputSchema, await readBody(event))
  return saveSocialAd(event, client, input)
})
