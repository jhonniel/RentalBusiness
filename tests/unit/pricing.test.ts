import { describe, expect, it } from 'vitest'
import { addMoney, inclusiveRentalDays, quoteExtensionLine, quoteRentalLine } from '../../utils/pricing'

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

  it('charges the daily price per day even when weekly and monthly prices are set', () => {
    const quote = quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: 5000,
      monthlyPrice: 15000,
      depositAmount: 0,
      quantity: 1,
      days: 7,
    })

    expect(quote.lineTotal).toBe(7000)
    expect(quote.lessAmount).toBe(0)

    expect(quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: 5000,
      monthlyPrice: 15000,
      depositAmount: 0,
      quantity: 1,
      days: 30,
      longStayLess: 100,
      longStayMinDays: 3,
    })).toMatchObject({ rentAmount: 30000, lessAmount: 3000, lineTotal: 27000 })
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

    const laterStart = quoteRentalLine({
      dailyPrice: 1000,
      weeklyPrice: null,
      monthlyPrice: null,
      depositAmount: 0,
      quantity: 1,
      days: 4,
      longStayLess: 50,
      longStayMinDays: 5,
    })
    expect(laterStart.lessAmount).toBe(0)
    expect(laterStart.lineTotal).toBe(4000)
  })

  it('charges an extension for the added days only and applies the less only when the extension reaches the minimum', () => {
    const prices = {
      dailyPrice: 1000,
      weeklyPrice: null,
      monthlyPrice: null,
      quantity: 1,
      longStayLess: 100,
      longStayMinDays: 3,
    }

    const short = quoteExtensionLine({ ...prices, extensionDays: 2 })
    expect(short).toMatchObject({ days: 2, rentAmount: 2000, lessAmount: 0, lineTotal: 2000 })
    expect(addMoney(1000, short.lineTotal)).toBe(3000)

    const long = quoteExtensionLine({ ...prices, extensionDays: 3 })
    expect(long).toMatchObject({ days: 3, rentAmount: 3000, lessAmount: 300, lineTotal: 2700 })
  })
})
