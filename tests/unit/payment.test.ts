import { describe, expect, it } from 'vitest'
import {
  signPaymentPayload,
  verifyPaymentSignature,
} from '../../server/utils/payment-signature'
import {
  canTransitionPaymentStatus,
  toPublicPayment,
} from '../../utils/payment'
import { createPaymentSchema, paymentWebhookSchema } from '../../utils/payment-validation'

describe('payment validation', () => {
  it('accepts a rental reference and rejects client-set amounts or status', () => {
    expect(createPaymentSchema.parse({
      rentalUuid: '66666666-6666-4666-8666-666666666666',
    })).toMatchObject({
      rentalUuid: '66666666-6666-4666-8666-666666666666',
    })

    expect(createPaymentSchema.safeParse({
      rentalUuid: '66666666-6666-4666-8666-666666666666',
      amount: 10500,
      status: 'paid',
      id: 4,
    }).success).toBe(false)
  })

  it('requires a provider transaction id on webhook events', () => {
    expect(paymentWebhookSchema.parse({
      provider: 'sandbox',
      providerTransactionId: 'sbx_1',
      status: 'paid',
    }).status).toBe('paid')

    expect(paymentWebhookSchema.safeParse({
      provider: 'sandbox',
      status: 'paid',
    }).success).toBe(false)
  })
})

describe('payment signatures and transitions', () => {
  it('accepts a matching HMAC and rejects a tampered body', () => {
    const secret = 'test-webhook-secret'
    const body = '{"provider":"sandbox","providerTransactionId":"sbx_1","status":"paid"}'
    const signature = signPaymentPayload(secret, body)

    expect(verifyPaymentSignature(secret, body, `sha256=${signature}`)).toBe(true)
    expect(verifyPaymentSignature(secret, body.replace('paid', 'failed'), `sha256=${signature}`)).toBe(false)
    expect(verifyPaymentSignature(secret, body, 'deadbeef')).toBe(false)
  })

  it('allows provider-driven success and forbids clients from reversing a paid payment to failed', () => {
    expect(canTransitionPaymentStatus('processing', 'paid')).toBe(true)
    expect(canTransitionPaymentStatus('paid', 'failed')).toBe(false)
    expect(canTransitionPaymentStatus('paid', 'paid')).toBe(true)
  })
})

describe('payment mapper', () => {
  it('never includes internal ids or provider transaction ids', () => {
    const payment = toPublicPayment({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      amount: 10500,
      currency: 'PHP',
      provider: 'sandbox',
      status: 'paid',
      payment_method: 'sandbox',
      paid_at: '2026-09-13T00:00:00.000Z',
      metadata: { checkoutUrl: 'http://localhost:3000/payments/sandbox?payment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      created_at: '2026-09-13T00:00:00.000Z',
    })

    expect(payment).not.toHaveProperty('id')
    expect(payment).not.toHaveProperty('rental_id')
    expect(payment).not.toHaveProperty('providerTransactionId')
    expect(payment.checkoutUrl).toContain('/payments/sandbox')
  })
})
