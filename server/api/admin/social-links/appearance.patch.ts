import { socialPageAppearanceSchema } from '../../../../utils/social-link-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { updateSocialPageAppearance } from '../../../services/social-link.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-social-links:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(socialPageAppearanceSchema, await readBody(event))
  return updateSocialPageAppearance(event, client, input)
})
