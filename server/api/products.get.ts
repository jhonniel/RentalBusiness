import { publicProductListQuerySchema } from '../../utils/product-validation'
import { parseWithSchema } from '../../utils/validation'
import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { getPublicSupabaseClient } from '../utils/supabase'
import { getPublicProducts } from '../services/catalog.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-catalog:${ip}`, 80, 60_000)
  const client = await getPublicSupabaseClient(event)
  const query = parseWithSchema(publicProductListQuerySchema, getQuery(event))
  return getPublicProducts(client, query)
})
