import { CURRENT_COOKIE_POLICY_META } from '../../../utils/constants'
import { defineApiHandler } from '../../utils/api'
import { readLegalDocument } from '../../utils/legal-document'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`cookie-policy-current:${ip}`, 80, 60_000)
  const body = await readLegalDocument('cookies-jry-v1.txt')

  return {
    ...CURRENT_COOKIE_POLICY_META,
    body,
  }
})
