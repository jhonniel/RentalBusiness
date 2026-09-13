import { randomUUID } from 'node:crypto'
import { AppError, ERROR_CODES } from '../../utils/errors'
import { verifyPaymentSignature } from '../../../utils/payment'
import { parseWithSchema } from '../../../utils/validation'
import { paymentWebhookSchema } from '../../../utils/payment-validation'
import type { CreatePaymentIntentInput, PaymentIntent, PaymentProvider, PaymentProviderEvent } from './provider'

export function createSandboxProvider(siteUrl: string): PaymentProvider {
  return {
    name: 'sandbox',
    createIntent(input: CreatePaymentIntentInput): PaymentIntent {
      const origin = siteUrl.replace(/\/$/, '')
      return {
        provider: 'sandbox',
        providerTransactionId: `sbx_${randomUUID()}`,
        checkoutUrl: `${origin}/payments/sandbox?payment=${input.paymentUuid}&return=${encodeURIComponent(input.returnUrl)}`,
      }
    },
    verifyWebhook(rawBody, signature, secret) {
      if (!verifyPaymentSignature(secret, rawBody, signature)) {
        throw new AppError('Invalid payment webhook signature.', 401, ERROR_CODES.UNAUTHORIZED)
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(rawBody)
      }
      catch {
        throw new AppError('Invalid payment webhook body.', 400, ERROR_CODES.VALIDATION_ERROR)
      }

      return parseWithSchema(paymentWebhookSchema, parsed)
    },
    async retrieve(providerTransactionId: string): Promise<PaymentProviderEvent> {
      throw new AppError(
        `Sandbox transaction ${providerTransactionId} is completed on the checkout page, not by remote retrieval.`,
        409,
        ERROR_CODES.CONFLICT,
      )
    },
  }
}
