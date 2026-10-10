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
    expect(quote.lessAmount).toBe(0)
  })

  it('subtracts the daily less times the days for a booking of 3 days or more', () => {
    const shortStay = quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: null,
      monthlyPrice: null,
      depositAmount: 500,
      quantity: 1,
      days: 2,
      longStayLess: 100,
    })
    expect(shortStay.lessAmount).toBe(0)
    expect(shortStay.lineTotal).toBe(2000)
    expect(shortStay.depositAmount).toBe(500)

    const longStay = quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: null,
      monthlyPrice: null,
      depositAmount: 500,
      quantity: 2,
      days: 3,
      longStayLess: 100,
    })
    expect(longStay.rentAmount).toBe(6000)
    expect(longStay.lessAmount).toBe(600)
    expect(longStay.lineTotal).toBe(5400)
    expect(longStay.depositAmount).toBe(1000)
  })
})
