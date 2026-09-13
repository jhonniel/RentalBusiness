import { forgotPasswordSchema } from '../../../utils/auth-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { resendSignupConfirmationEmail } from '../../services/auth-email.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const body = await readBody(event)
  const input = parseWithSchema(forgotPasswordSchema, body)

  assertRateLimit(`auth-resend:${ip}`, 8, 15 * 60_000)
  assertRateLimit(`auth-resend-email:${input.email}`, 5, 15 * 60_000)

  return resendSignupConfirmationEmail(input.email)
})
