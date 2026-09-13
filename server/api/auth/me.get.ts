import { defineApiHandler } from '../../utils/api'
import { getCurrentProfile } from '../../utils/auth'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler((event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`auth-me:${ip}`, 60, 60_000)
  return getCurrentProfile(event)
})
