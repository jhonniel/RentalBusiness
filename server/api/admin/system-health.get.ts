import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { assertRateLimit } from '../../utils/rate-limit'
import { getAdminSystemHealth } from '../../services/system-health.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-system-health:${profile.uuid}`, 30, 60_000)
  return getAdminSystemHealth(client)
})
