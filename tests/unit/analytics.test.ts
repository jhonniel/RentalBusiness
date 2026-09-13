import { describe, expect, it } from 'vitest'
import { adminRentalListQuerySchema } from '../../utils/admin-validation'
import { buildKpis, lastCalendarDays, paidSalesOn, topRentedProducts } from '../../utils/analytics'
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
      overdueRentals: 1,
      totalExpenses: 500,
      netRevenue: 13500,
      totalCustomers: 4,
      inventoryValue: 2000,
    })
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
