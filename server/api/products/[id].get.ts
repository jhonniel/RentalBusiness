import { productIdentifierSchema } from '../../../utils/product-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { getPublicSupabaseClient } from '../../utils/supabase'
import { getPublicProduct } from '../../services/catalog.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-catalog:${ip}`, 80, 60_000)
  const identifier = parseWithSchema(productIdentifierSchema, getRouterParam(event, 'id') || '')
  const client = await getPublicSupabaseClient(event)
  return getPublicProduct(client, identifier)
})
