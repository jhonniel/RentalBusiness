import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { rotateSocialPageCode } from '../../../services/social-link.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-social-links-rotate:${profile.uuid}`, 10, 60_000)
  return rotateSocialPageCode(event, client)
})
