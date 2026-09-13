import { AppError, ERROR_CODES } from '../../utils/errors'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { applyPaymentEvent } from '../../services/payment.service'
import { getPaymentProvider, requirePaymentWebhookSecret } from '../../services/payments'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`payment-webhook:${ip}`, 60, 60_000)
  const secret = requirePaymentWebhookSecret()

  const raw = await readRawBody(event)
  if (!raw) {
    throw new AppError('Missing webhook body.', 400, ERROR_CODES.VALIDATION_ERROR)
  }
  const provider = getPaymentProvider()
  const signature = getHeader(event, 'x-lumen-payment-signature')
  const payload = provider.verifyWebhook(raw, signature, secret)
  const payment = await applyPaymentEvent(event, payload)
  return { received: true, status: payment.status }
})
