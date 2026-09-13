import { describe, expect, it } from 'vitest'
import { inclusiveRentalDays, quoteRentalLine } from '../../utils/pricing'

describe('inclusive rental days', () => {
  it('counts same-day as one day and Sept 11-13 as three', () => {
    expect(inclusiveRentalDays('2026-09-11', '2026-09-11')).toBe(1)
    expect(inclusiveRentalDays('2026-09-11', '2026-09-13')).toBe(3)
  })
})

describe('rental quotes', () => {
  it('multiplies daily rate by days and quantity', () => {
    expect(quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: null,
      monthlyPrice: null,
      depositAmount: 500,
      quantity: 2,
      days: 3,
    })).toMatchObject({
      lineTotal: 6000,
      depositAmount: 1000,
    })
  })

  it('uses a weekly rate when it is cheaper', () => {
    const quote = quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: 5000,
      monthlyPrice: null,
      depositAmount: 0,
      quantity: 1,
      days: 7,
    })

    expect(quote.lineTotal).toBe(5000)
  })
})
