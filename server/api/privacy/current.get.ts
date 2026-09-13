import { CURRENT_PRIVACY_POLICY_META } from '../../../utils/privacy-policy'
import { defineApiHandler } from '../../utils/api'
import { readLegalDocument } from '../../utils/legal-document'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`privacy-current:${ip}`, 80, 60_000)
  const body = await readLegalDocument('privacy-jry-v1.txt')

  return {
    ...CURRENT_PRIVACY_POLICY_META,
    body,
  }
})
