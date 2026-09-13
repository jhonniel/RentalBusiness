import { describe, expect, it } from 'vitest'
import { publicQrUrl, toPublicPaymentMethod } from '../../utils/payment-method'
import { paymentMethodInputSchema } from '../../utils/payment-method-validation'

const row = {
  uuid: '33333333-3333-4333-8333-333333333333',
  code: 'gcash',
  name: 'GCash',
  account_name: 'JRY Rentals',
  account_number: '09171234567',
  instructions: 'Send the rental total.',
  qr_storage_path: '33333333-3333-4333-8333-333333333333/qr.png',
  sort_order: 1,
  is_active: true,
}

describe('payment method validation', () => {
  it('accepts a valid method payload', () => {
    expect(paymentMethodInputSchema.parse({
      name: 'GCash',
      accountName: 'JRY Rentals',
      accountNumber: '09171234567',
      instructions: 'Send the rental total.',
      sortOrder: 1,
      isActive: true,
    })).toMatchObject({
      name: 'GCash',
      isActive: true,
    })
  })

  it('rejects internal ids and unknown fields', () => {
    expect(paymentMethodInputSchema.safeParse({
      name: 'GCash',
      id: 4,
    }).success).toBe(false)
  })

  it('rejects an invalid code', () => {
    expect(paymentMethodInputSchema.safeParse({
      name: 'GCash',
      code: 'GCash Wallet',
    }).success).toBe(false)
  })
})

describe('payment method mapping', () => {
  it('maps public fields and builds a QR URL', () => {
    expect(toPublicPaymentMethod(row, 'https://example.supabase.co/')).toEqual({
      uuid: row.uuid,
      code: 'gcash',
      name: 'GCash',
      accountName: 'JRY Rentals',
      accountNumber: '09171234567',
      instructions: 'Send the rental total.',
      qrUrl: 'https://example.supabase.co/storage/v1/object/public/payment-qr-images/33333333-3333-4333-8333-333333333333/qr.png',
      sortOrder: 1,
      isActive: true,
    })
  })

  it('omits a QR URL when no image is stored', () => {
    expect(toPublicPaymentMethod({
      ...row,
      qr_storage_path: null,
    }, 'https://example.supabase.co').qrUrl).toBeNull()
  })

  it('builds a public QR object URL', () => {
    expect(publicQrUrl('https://example.supabase.co', 'method/qr.png')).toBe(
      'https://example.supabase.co/storage/v1/object/public/payment-qr-images/method/qr.png',
    )
  })
})
