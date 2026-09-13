import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CURRENT_TERMS_META } from '../../../utils/terms'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler((event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`terms-current:${ip}`, 80, 60_000)
  const body = readFileSync(resolve(process.cwd(), 'supabase/terms-jry-v1.txt'), 'utf8').trim()

  return {
    ...CURRENT_TERMS_META,
    body,
  }
})
