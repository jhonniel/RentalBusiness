import { describe, expect, it } from 'vitest'
import { applyVoucherSchema, voucherInputSchema } from '../../utils/voucher-validation'
import {
  generateVoucherCode,
  normalizeVoucherCode,
  quoteVoucherDiscount,
  toPublicRentalVoucher,
  voucherDisplayStatus,
  voucherIsRedeemable,
} from '../../utils/voucher'

describe('voucher codes', () => {
  it('normalizes and generates shop codes without ambiguous characters', () => {
    expect(normalizeVoucherCode(' jry-ab12! ')).toBe('JRY-AB12')
    expect(generateVoucherCode()).toMatch(/^JRY-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
  })
})

describe('voucher quotes', () => {
  it('caps percent and fixed discounts at the subtotal', () => {
    expect(quoteVoucherDiscount({ type: 'percent', value: 10, subtotal: 1000 })).toBe(100)
    expect(quoteVoucherDiscount({ type: 'percent', value: 100, subtotal: 2500 })).toBe(2500)
    expect(quoteVoucherDiscount({ type: 'fixed', value: 200, subtotal: 150 })).toBe(150)
    expect(quoteVoucherDiscount({ type: 'fixed', value: 200, subtotal: 500 })).toBe(200)
  })
})

describe('voucher redeemability', () => {
  const base = {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    code: 'JRY-WELCOME',
    name: 'Welcome',
    discount_type: 'percent' as const,
    discount_value: 10,
    max_redemptions: 5,
    redeemed_count: 1,
    min_subtotal: 1000,
    starts_on: '2026-09-01',
    ends_on: '2026-09-30',
    status: 'active' as const,
    created_at: '2026-09-01T00:00:00.000Z',
  }

  it('rejects inactive, expired, used-up, and below-minimum codes', () => {
    expect(voucherIsRedeemable(base, 2000, '2026-09-19')).toBeNull()
    expect(voucherIsRedeemable({ ...base, status: 'disabled' }, 2000, '2026-09-19')).toBe('That voucher is not active.')
    expect(voucherIsRedeemable(base, 2000, '2026-10-01')).toBe('That voucher has expired.')
    expect(voucherIsRedeemable(base, 2000, '2026-08-31')).toBe('That voucher is not valid yet.')
    expect(voucherIsRedeemable({ ...base, redeemed_count: 5 }, 2000, '2026-09-19')).toBe('That voucher has already been used up.')
    expect(voucherIsRedeemable(base, 500, '2026-09-19')).toBe('This booking does not meet the minimum amount for that voucher.')
    expect(voucherDisplayStatus(base, '2026-10-01')).toBe('expired')
    expect(voucherDisplayStatus(base, '2026-08-31')).toBe('scheduled')
  })
})

describe('voucher validation', () => {
  it('generates a code when blank and rejects a percent over 100', () => {
    const parsed = voucherInputSchema.parse({
      name: 'Welcome',
      code: '',
      discountType: 'percent',
      discountValue: 15,
      status: 'active',
    })
    expect(parsed.code).toMatch(/^JRY-/)

    expect(voucherInputSchema.safeParse({
      name: 'Too much',
      code: 'JRY-OVER',
      discountType: 'percent',
      discountValue: 150,
    }).success).toBe(false)

    expect(applyVoucherSchema.parse({ code: ' jry-ab12 ' })).toMatchObject({ code: 'jry-ab12' })
  })
})

describe('rental voucher mapper', () => {
  it('exposes the applied code without an internal id', () => {
    expect(toPublicRentalVoucher({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      code: 'JRY-WELCOME',
      name: 'Welcome',
      discount_amount: 350,
    })).toEqual({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      code: 'JRY-WELCOME',
      name: 'Welcome',
      discountAmount: 350,
    })
    expect(toPublicRentalVoucher([])).toBeNull()
  })
})
