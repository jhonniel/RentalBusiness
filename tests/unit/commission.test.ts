import { describe, expect, it } from 'vitest'
import { canCollectCommission, canReleaseCommissionerBooking, commissionAmount, commissionStillToRecord, isCommissionEarned, summarizeCommissions } from '../../utils/commission'

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

  it('earns a commission once the booking is approved', () => {
    expect(isCommissionEarned('approved')).toBe(true)
    expect(isCommissionEarned('active')).toBe(true)
    expect(isCommissionEarned('completed')).toBe(true)
    expect(isCommissionEarned('paid')).toBe(false)
    expect(isCommissionEarned('pending')).toBe(false)
    expect(isCommissionEarned('cancelled')).toBe(false)
    expect(canCollectCommission('pending', 'approved')).toBe(true)
    expect(canCollectCommission('pending', 'pending')).toBe(false)
    expect(canCollectCommission('paid', 'completed')).toBe(false)
  })

  it('records only what is not yet collected', () => {
    expect(commissionStillToRecord(300, 0)).toBe(300)
    expect(commissionStillToRecord(500, 300)).toBe(200)
    expect(commissionStillToRecord(300, 300)).toBe(0)
    expect(commissionStillToRecord(200, 300)).toBe(0)
  })

  it('sums unclaimed and collected commissions per commissioner, unclaimed first', () => {
    const base = {
      earnedOn: '2026-10-18',
      collectedAt: null,
      rental: { uuid: 'r', code: 'JRY-20261015-00026', pickupAt: null, returnAt: null, equipment: 'Starlink Mini' },
    }
    const ana = { uuid: '11111111-1111-4111-8111-111111111111', firstName: 'Ana', lastName: 'Reyes' }
    const ben = { uuid: '22222222-2222-4222-8222-222222222222', firstName: 'Ben', lastName: 'Cruz' }
    const summary = summarizeCommissions([
      { ...base, uuid: 'a', amount: 200, status: 'unclaimed', commissioner: ana },
      { ...base, uuid: 'b', amount: 300, status: 'collected', commissioner: ana },
      { ...base, uuid: 'c', amount: 500, status: 'unclaimed', commissioner: ben },
      { ...base, uuid: 'd', amount: 100, status: 'unclaimed', commissioner: ben },
    ])

    expect(summary.map(person => person.firstName)).toEqual(['Ben', 'Ana'])
    expect(summary[0]).toMatchObject({ unclaimedAmount: 600, collectedAmount: 0, unclaimedCount: 2 })
    expect(summary[1]).toMatchObject({ unclaimedAmount: 200, collectedAmount: 300, unclaimedCount: 1 })
  })
})
