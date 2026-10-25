import { describe, expect, it } from 'vitest'
import { adminRentalListQuerySchema } from '../../utils/admin-validation'
import { actualSalesOn, buildKpis, commissionerRanks, isOngoingRental, lastCalendarDays, paidSalesOn, topRentedProducts } from '../../utils/analytics'
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
      ],
      expenses: [{ amount: 500, status: 'paid' }],
      products: [{ quantity: 2, replacement_value: 1000 }],
      customerCount: 4,
      today: '2026-09-13',
    })).toMatchObject({
      todaySales: 10500,
      monthSales: 10500,
      totalSales: 14000,
      pendingRentals: 1,
      upcomingRentals: 1,
      activeRentals: 1,
      overdueRentals: 1,
      totalExpenses: 500,
      netRevenue: 13500,
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

  it('takes commissions off on the day they are recorded', () => {
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
})
