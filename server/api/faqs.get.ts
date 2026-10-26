import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { getPublicSupabaseClient } from '../utils/supabase'
import { getPublicFaqs } from '../services/faq.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-faqs:${ip}`, 60, 60_000)
  const client = await getPublicSupabaseClient(event)
  return getPublicFaqs(client)
})
