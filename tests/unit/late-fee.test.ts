import { describe, expect, it } from 'vitest'
import { adminLateFeeTypeSchema } from '../../utils/rental-validation'
import { buildLateFee, canPayLateFee, canVoidLateFee, computeLateFee, lateDuration, lateFeeStatus } from '../../utils/late-fee'

const returnAt = '2026-10-24T02:00:00.000Z'

describe('late fee amounts', () => {
  it('measures how late a return is', () => {
    expect(lateDuration(returnAt, '2026-10-24T01:00:00.000Z')).toEqual({ hoursLate: 0, daysLate: 0 })
    expect(lateDuration(returnAt, '2026-10-24T05:30:00.000Z')).toEqual({ hoursLate: 3.5, daysLate: 1 })
    expect(lateDuration(returnAt, '2026-10-26T03:00:00.000Z')).toEqual({ hoursLate: 49, daysLate: 3 })
  })

  it('follows the waiver schedule by default', () => {
    const base = { type: 'schedule' as const, dailyRent: 900 }
    expect(computeLateFee({ ...base, hoursLate: 0 })).toBe(0)
    expect(computeLateFee({ ...base, hoursLate: 5.9 })).toBe(300)
    expect(computeLateFee({ ...base, hoursLate: 6 })).toBe(450)
    expect(computeLateFee({ ...base, hoursLate: 12 })).toBe(450)
    expect(computeLateFee({ ...base, hoursLate: 13 })).toBe(900)
    expect(computeLateFee({ ...base, hoursLate: 30 })).toBe(1800)
  })

  it('supports the other late fee types', () => {
    expect(computeLateFee({ type: 'product', hoursLate: 30, dailyRent: 900, productLateFee: 500 })).toBe(1000)
    expect(computeLateFee({ type: 'half_day', hoursLate: 30, dailyRent: 900 })).toBe(900)
    expect(computeLateFee({ type: 'full_day', hoursLate: 2, dailyRent: 900 })).toBe(900)
    expect(computeLateFee({ type: 'custom', hoursLate: 2, dailyRent: 900, customAmount: 250 })).toBe(250)
    expect(computeLateFee({ type: 'custom', hoursLate: 0, dailyRent: 900, customAmount: 250 })).toBe(0)
  })

  it('needs an amount for a custom late fee', () => {
    expect(adminLateFeeTypeSchema.safeParse({ type: 'custom' }).success).toBe(false)
    expect(adminLateFeeTypeSchema.parse({ type: 'custom', customAmount: '150' })).toEqual({ type: 'custom', customAmount: 150 })
    expect(adminLateFeeTypeSchema.safeParse({ type: 'weekly' }).success).toBe(false)
  })
})

describe('late fee status', () => {
  const rental = {
    status: 'active' as const,
    returnAt,
    items: [{ uuid: 'i', quantity: 1, dailyPrice: 900, lineTotal: 2700, product: { uuid: 'p', slug: 's', name: 'Starlink Mini', sku: 'SKU', depositAmount: 500, lateFee: 300, replacementValue: null } }],
  }

  it('adds up on its own while the equipment is out and late', () => {
    const fee = buildLateFee(rental, null, true, new Date('2026-10-24T05:00:00.000Z'))
    expect(fee).toMatchObject({ status: 'accruing', amount: 300, type: 'schedule', hoursLate: 3, dailyRent: 900 })
    expect(buildLateFee(rental, null, true, new Date('2026-10-24T01:00:00.000Z')).status).toBe('none')
  })

  it('stops at the stored time and can be voided or paid', () => {
    const row = {
      uuid: 'f',
      rental_id: 1,
      fee_type: 'full_day' as const,
      custom_amount: null,
      stopped_at: '2026-10-25T03:00:00.000Z',
      paid_amount: null,
      paid_at: null,
      voided_at: null,
      void_reason: null,
    }
    const done = { ...rental, status: 'completed' as const }
    expect(buildLateFee(done, row, true, new Date('2026-10-30T00:00:00.000Z'))).toMatchObject({ status: 'due', amount: 1800, daysLate: 2 })
    expect(buildLateFee(done, { ...row, voided_at: '2026-10-25T04:00:00.000Z' }, true).status).toBe('void')
    expect(buildLateFee(done, { ...row, paid_amount: 1500, paid_at: '2026-10-25T04:00:00.000Z' }, true)).toMatchObject({ status: 'paid', amount: 1500 })
  })

  it('only lets an open late fee be paid or voided', () => {
    expect(lateFeeStatus({ rentalStatus: 'completed', amount: 0, paid: false, voided: false, stopped: false })).toBe('none')
    expect(canPayLateFee('due')).toBe(true)
    expect(canPayLateFee('void')).toBe(false)
    expect(canVoidLateFee('paid')).toBe(false)
  })
})
