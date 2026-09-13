import { registerAccountSchema } from '../../../utils/auth-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { registerWithConfirmationEmail } from '../../services/auth-email.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`auth-register:${ip}`, 8, 15 * 60_000)

  const body = await readBody(event)
  const input = parseWithSchema(registerAccountSchema, body)

  return registerWithConfirmationEmail(input)
})
