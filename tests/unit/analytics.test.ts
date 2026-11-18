import { describe, expect, it } from 'vitest'
import { adminRentalListQuerySchema } from '../../utils/admin-validation'
import { actualSalesOn, buildKpis, commissionerRanks, isOngoingRental, lastCalendarDays, paidSalesOn, rentalSaleDates, salesByDay, topRentedProducts } from '../../utils/analytics'
import { paymentSaleAmount } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'

describe('analytics dates and sales', () => {
  it('builds a 14-day calendar range ending on the business date', () => {
    expect(lastCalendarDays(3, '2026-09-13')).toEqual([
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('counts only paid amounts inside the selected Manila dates', () => {
    const payments = [
      { amount: 10500, status: 'paid' as const, paid_at: '2026-09-13T02:00:00.000Z' },
      { amount: 2000, status: 'failed' as const, paid_at: '2026-09-13T02:00:00.000Z' },
      { amount: 3500, status: 'paid' as const, paid_at: '2026-08-01T02:00:00.000Z' },
    ]

    expect(paidSalesOn(payments, '2026-09-13', '2026-09-13')).toBe(10500)
    expect(buildKpis({
      payments,
      rentals: [
        { status: 'pending', starts_on: '2026-09-20' },
        { status: 'paid', starts_on: '2026-09-20' },
        { status: 'overdue', starts_on: '2026-09-01' },
        { status: 'completed', starts_on: '2026-08-01' },
        { status: 'returned', starts_on: '2026-08-02' },
        { status: 'cancelled', starts_on: '2026-08-03' },
        { status: 'rejected', starts_on: '2026-08-04' },
        { status: 'draft', starts_on: '2026-09-25' },
      ],
      expenses: [
        { amount: 500, status: 'paid' },
        { amount: 300, status: 'pending', category: 'commission', incurred_on: '2026-08-02' },
        { amount: 900, status: 'void', category: 'commission', incurred_on: '2026-08-02' },
      ],
      products: [{ quantity: 2, replacement_value: 1000 }],
      customerCount: 4,
      today: '2026-09-13',
    })).toMatchObject({
      todaySales: 10500,
      monthSales: 10500,
      totalSales: 13700,
      pendingRentals: 1,
      upcomingRentals: 1,
      activeRentals: 1,
      overdueRentals: 1,
      doneRentals: 2,
      cancelledRentals: 2,
      totalExpenses: 500,
      totalCommissions: 300,
      totalSpent: 800,
      netRevenue: 13200,
      totalCustomers: 4,
      inventoryValue: 2000,
    })
  })
})

describe('ongoing rentals', () => {
  it('counts an approved rental while its pickup window is still open', () => {
    const rental = {
      status: 'approved' as const,
      starts_on: '2026-10-05',
      ends_on: '2026-10-06',
      pickup_at: '2026-10-05T06:00:00.000Z',
      return_at: '2026-10-06T06:00:00.000Z',
    }

    expect(isOngoingRental(rental, new Date('2026-10-06T00:00:00.000Z'))).toBe(true)
    expect(isOngoingRental(rental, new Date('2026-10-06T06:00:00.000Z'))).toBe(false)
    expect(buildKpis({
      payments: [],
      rentals: [rental],
      expenses: [],
      products: [],
      customerCount: 0,
      today: '2026-10-06',
      now: new Date('2026-10-06T00:00:00.000Z'),
    }).activeRentals).toBe(1)
  })
})

describe('commissioner ranks', () => {
  it('ranks commissioners from the highest commission to the lowest and counts only completed bookings', () => {
    const ranks = commissionerRanks([
      {
        commissionAmount: 300,
        status: 'completed',
        commissioner: { uuid: '11111111-1111-4111-8111-111111111111', firstName: 'Ana', lastName: 'Reyes' },
      },
      {
        commissionAmount: 900,
        status: 'completed',
        commissioner: { uuid: '22222222-2222-4222-8222-222222222222', firstName: 'Ben', lastName: 'Cruz' },
      },
      {
        commissionAmount: 150,
        status: 'approved',
        commissioner: { uuid: '11111111-1111-4111-8111-111111111111', firstName: 'Ana', lastName: 'Reyes' },
      },
      {
        commissionAmount: 5000,
        status: 'pending',
        commissioner: { uuid: '11111111-1111-4111-8111-111111111111', firstName: 'Ana', lastName: 'Reyes' },
      },
      {
        commissionAmount: 2000,
        status: 'cancelled',
        commissioner: { uuid: '22222222-2222-4222-8222-222222222222', firstName: 'Ben', lastName: 'Cruz' },
      },
    ])

    expect(ranks.map(rank => rank.firstName)).toEqual(['Ben', 'Ana'])
    expect(ranks[0]?.commissionAmount).toBe(900)
    expect(ranks[1]).toMatchObject({ commissionAmount: 450, bookings: 2 })
    expect(ranks[0]).not.toHaveProperty('id')
  })
})

describe('most-rented products', () => {
  it('ignores cancelled rentals and never includes internal ids', () => {
    const products = topRentedProducts([
      {
        quantity: 2,
        rentalStatus: 'paid',
        product: { uuid: '22222222-2222-4222-8222-222222222222', name: 'Sony A7 IV', sku: 'CAM-A7IV-001' },
      },
      {
        quantity: 5,
        rentalStatus: 'cancelled',
        product: { uuid: '22222222-2222-4222-8222-222222222222', name: 'Sony A7 IV', sku: 'CAM-A7IV-001' },
      },
    ])

    expect(products[0]?.quantity).toBe(2)
    expect(products[0]).not.toHaveProperty('id')
    expect(canTransitionRentalStatus('paid', 'approved')).toBe(true)
    expect(canTransitionRentalStatus('pending', 'approved')).toBe(true)
  })

  it('rejects admin list queries that include internal ids', () => {
    expect(adminRentalListQuerySchema.safeParse({
      search: 'LUM-20260913-00001',
      id: 9,
    }).success).toBe(false)
  })
})

describe('actual sales', () => {
  it('leaves out a deposit the shop still holds', () => {
    expect(paymentSaleAmount({ amount: 3200, metadata: { includesDeposit: true, depositAmount: 500 } })).toBe(2700)
    expect(paymentSaleAmount({ amount: 2700, metadata: { includesDeposit: true, depositAmount: 500, depositReturnedAt: '2026-10-26T00:00:00Z' } })).toBe(2700)
    expect(paymentSaleAmount({ amount: 3200, metadata: { includesDeposit: true, depositAmount: 500, nonRefundable: true } })).toBe(3200)
    expect(paymentSaleAmount({ amount: 1000, metadata: { kind: 'extension' } })).toBe(1000)
  })

  it('takes a commission with no linked booking off on the day it was recorded', () => {
    const payments = [
      { amount: 3200, status: 'paid' as const, paid_at: '2026-10-20T05:00:00.000Z', metadata: { includesDeposit: true, depositAmount: 500 } },
      { amount: 1000, status: 'paid' as const, paid_at: '2026-10-24T05:00:00.000Z', metadata: { kind: 'extension' } },
    ]
    const expenses = [
      { amount: 400, status: 'pending', category: 'commission', incurred_on: '2026-10-20' },
      { amount: 999, status: 'void', category: 'commission', incurred_on: '2026-10-20' },
      { amount: 1500, status: 'paid', category: 'internet', incurred_on: '2026-10-20' },
    ]
    expect(actualSalesOn(payments, expenses, '2026-10-01', '2026-10-31')).toBe(3300)
    expect(actualSalesOn(payments, expenses, '2026-10-20', '2026-10-20')).toBe(2300)
  })

  it('takes each booking commission off on the day that booking was paid, not the day it was approved', () => {
    const payments = [
      { rental_id: 51, amount: 1500, status: 'paid' as const, paid_at: '2026-11-12T05:29:00.000Z', metadata: { includesDeposit: true, depositAmount: 500 } },
      { rental_id: 49, amount: 2500, status: 'paid' as const, paid_at: '2026-11-17T01:40:00.000Z', metadata: { includesDeposit: true, depositAmount: 500 } },
      { rental_id: 24, amount: 3600, status: 'paid' as const, paid_at: '2026-10-20T07:06:00.000Z' },
      { rental_id: 24, amount: 1000, status: 'paid' as const, paid_at: '2026-10-25T06:10:00.000Z', metadata: { kind: 'extension' } },
    ]
    const expenses = [
      { rental_id: 51, amount: 100, status: 'pending', category: 'commission', incurred_on: '2026-11-17' },
      { rental_id: 49, amount: 200, status: 'pending', category: 'commission', incurred_on: '2026-11-17' },
      { rental_id: 24, amount: 500, status: 'pending', category: 'commission', incurred_on: '2026-10-23' },
      { rental_id: 99, amount: 300, status: 'void', category: 'commission', incurred_on: '2026-11-17' },
    ]

    expect([...rentalSaleDates(payments)]).toEqual([[51, '2026-11-12'], [49, '2026-11-17'], [24, '2026-10-20']])
    expect(salesByDay(payments, ['2026-11-12', '2026-11-17', '2026-10-20', '2026-10-23', '2026-10-25'], expenses)).toEqual([
      { label: '2026-11-12', value: 900 },
      { label: '2026-11-17', value: 1800 },
      { label: '2026-10-20', value: 3100 },
      { label: '2026-10-23', value: 0 },
      { label: '2026-10-25', value: 1000 },
    ])
    expect(actualSalesOn(payments, expenses, '2026-11-01', '2026-11-30')).toBe(2700)
    expect(actualSalesOn(payments, expenses, '1970-01-01', '2026-11-30')).toBe(6800)
  })

  it('accepts the rental list groups and rejects unknown ones', () => {
    expect(adminRentalListQuerySchema.parse({ group: 'upcoming' })).toMatchObject({ group: 'upcoming', page: 1, pageSize: 20 })
    for (const group of ['active', 'done', 'cancelled']) {
      expect(adminRentalListQuerySchema.safeParse({ group }).success).toBe(true)
    }
    expect(adminRentalListQuerySchema.safeParse({ group: 'pending' }).success).toBe(false)
    expect(adminRentalListQuerySchema.safeParse({ group: 'active', status: 'approved' }).success).toBe(true)
  })

  it('counts a booked rental as upcoming before pickup and active once the pickup time passes', () => {
    const rental = {
      status: 'approved' as const,
      starts_on: '2026-11-17',
      ends_on: '2026-11-19',
      pickup_at: '2026-11-17T01:30:00.000Z',
      return_at: '2026-11-19T01:30:00.000Z',
    }
    const kpisAt = (now: string) => buildKpis({ payments: [], rentals: [rental], expenses: [], products: [], customerCount: 0, today: now.slice(0, 10), now: new Date(now) })

    expect(kpisAt('2026-11-17T01:29:00.000Z')).toMatchObject({ upcomingRentals: 1, activeRentals: 0 })
    expect(kpisAt('2026-11-17T01:30:00.000Z')).toMatchObject({ upcomingRentals: 0, activeRentals: 1 })
    expect(kpisAt('2026-11-19T01:30:00.000Z')).toMatchObject({ upcomingRentals: 0, activeRentals: 0 })
  })
})
