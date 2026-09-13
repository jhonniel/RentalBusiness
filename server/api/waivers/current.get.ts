import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { getPublicSupabaseClient } from '../../utils/supabase'
import { getCurrentWaiver } from '../../services/waiver.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`waiver-current:${ip}`, 80, 60_000)
  const client = await getPublicSupabaseClient(event)
  return getCurrentWaiver(client)
})
