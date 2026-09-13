import { availabilityQuerySchema } from '../../utils/product-validation'
import { parseWithSchema } from '../../utils/validation'
import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { getProductAvailability } from '../services/availability.service'
import { getPublicSupabaseClient } from '../utils/supabase'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-availability:${ip}`, 80, 60_000)
  const client = await getPublicSupabaseClient(event)
  const query = parseWithSchema(availabilityQuerySchema, getQuery(event))
  return getProductAvailability(client, query)
})
