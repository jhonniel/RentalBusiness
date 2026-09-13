import { AppError, ERROR_CODES } from '../../utils/errors'
import { isUsableSecret } from '../../../utils/env'
import { createSandboxProvider } from './sandbox.provider'
import type { PaymentProvider } from './provider'

export function getPaymentProvider(): PaymentProvider {
  const config = useRuntimeConfig()
  const name = String(process.env.PAYMENT_PROVIDER || process.env.NUXT_PAYMENT_PROVIDER || 'sandbox').toLowerCase()
  const siteUrl = String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000')

  if (name === 'sandbox') {
    return createSandboxProvider(siteUrl)
  }

  throw new AppError('That payment provider is not configured.', 503, ERROR_CODES.INTERNAL_ERROR)
}

export function getPaymentWebhookSecret() {
  const config = useRuntimeConfig()
  return String(config.paymentWebhookSecret || process.env.PAYMENT_WEBHOOK_SECRET || process.env.NUXT_PAYMENT_WEBHOOK_SECRET || '')
}

export function requirePaymentWebhookSecret() {
  const secret = getPaymentWebhookSecret()
  if (!isUsableSecret(secret)) {
    throw new AppError('Payment webhooks are not configured.', 503, ERROR_CODES.INTERNAL_ERROR)
  }
  return secret
}
