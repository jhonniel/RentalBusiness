import { CURRENT_TERMS_META } from '../../../utils/terms'
import { defineApiHandler } from '../../utils/api'
import { readLegalDocument } from '../../utils/legal-document'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`terms-current:${ip}`, 80, 60_000)
  const body = await readLegalDocument('terms-jry-v1.txt')

  return {
    ...CURRENT_TERMS_META,
    body,
  }
})
