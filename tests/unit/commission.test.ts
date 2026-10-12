import { describe, expect, it } from 'vitest'
import { canReleaseCommissionerBooking, commissionAmount } from '../../utils/commission'

describe('commission', () => {
  it('uses the equipment daily rate for each rented day and unit', () => {
    expect(commissionAmount(150, '2026-10-20', '2026-10-21', 1)).toBe(150)
    expect(commissionAmount(150, '2026-10-20', '2026-10-22', 2)).toBe(600)
    expect(commissionAmount(0, '2026-10-20', '2026-10-23', 1)).toBe(0)
  })

  it('lets a commissioner release a hold before it is paid', () => {
    expect(canReleaseCommissionerBooking('pending')).toBe(true)
    expect(canReleaseCommissionerBooking('awaiting_payment')).toBe(true)
    expect(canReleaseCommissionerBooking('paid')).toBe(false)
    expect(canReleaseCommissionerBooking('cancelled')).toBe(false)
  })
})
