import type { PaymentStatus } from '../../../utils/constants'
import type { PaymentWebhookInput } from '../../../utils/payment-validation'

export interface CreatePaymentIntentInput {
  amount: number
  currency: string
  rentalCode: string
  paymentUuid: string
  returnUrl: string
}

export interface PaymentIntent {
  provider: string
  providerTransactionId: string
  checkoutUrl: string
}

export interface PaymentProviderEvent {
  provider: string
  providerTransactionId: string
  status: PaymentStatus
  paymentMethod: string | null
  paidAt: string | null
}

export interface PaymentProvider {
  readonly name: string
  createIntent: (input: CreatePaymentIntentInput) => PaymentIntent | Promise<PaymentIntent>
  verifyWebhook: (rawBody: string, signature: string | undefined, secret: string) => PaymentWebhookInput
  retrieve: (providerTransactionId: string) => Promise<PaymentProviderEvent>
}
