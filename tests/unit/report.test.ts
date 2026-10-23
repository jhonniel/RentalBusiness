import { describe, expect, it } from 'vitest'
import { inclusiveDayCount, overlapDayCount } from '../../utils/datetime'
import { toCsv } from '../../utils/csv'
import {
  bookingStats,
  commissionsByCommissioner,
  expensesByCategory,
  expensesByVendor,
  expenseStatusTotals,
  expenseTotal,
  reportPeriodRange,
  financeSummary,
  groupMonthsByYear,
  reportBucketFor,
  reportBuckets,
  salesByMethod,
  toCommissionRows,
  toExpenseRows,
  toMonthGroups,
  toReportCsv,
  toSalesRows,
  toTrendPoints,
  toUtilizationRows,
} from '../../utils/report'
import { reportQuerySchema } from '../../utils/report-validation'

describe('report dates', () => {
  it('counts inclusive calendar days and overlaps', () => {
    expect(inclusiveDayCount('2026-09-11', '2026-09-13')).toBe(3)
    expect(inclusiveDayCount('2026-09-13', '2026-09-13')).toBe(1)
    expect(overlapDayCount('2026-09-10', '2026-09-12', '2026-09-11', '2026-09-13')).toBe(2)
    expect(overlapDayCount('2026-09-01', '2026-09-02', '2026-09-11', '2026-09-13')).toBe(0)
  })
})

describe('report rows', () => {
  it('counts paid sales only and excludes void expenses from profit totals', () => {
    const sales = toSalesRows([
      {
        uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        amount: 10500,
        currency: 'PHP',
        status: 'paid',
        payment_method: 'sandbox',
        paid_at: '2026-09-13T02:00:00.000Z',
        rental_requests: { uuid: '66666666-6666-4666-8666-666666666666', code: 'LUM-20260913-00001' },
      },
      {
        uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        amount: 2000,
        currency: 'PHP',
        status: 'failed',
        payment_method: null,
        paid_at: '2026-09-13T02:00:00.000Z',
      },
    ], '2026-09-13', '2026-09-13')

    const expenses = toExpenseRows([
      {
        uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Cleaning',
        category: 'maintenance',
        vendor: null,
        reference: null,
        amount: 1800,
        status: 'paid',
        incurred_on: '2026-09-13',
      },
      {
        uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        name: 'Voided',
        category: 'other',
        vendor: null,
        reference: null,
        amount: 500,
        status: 'void',
        incurred_on: '2026-09-13',
      },
    ], '2026-09-13', '2026-09-13')

    expect(sales).toHaveLength(1)
    expect(sales[0]).not.toHaveProperty('id')
    expect(sales[0]?.rentalCode).toBe('LUM-20260913-00001')
    expect(expenseTotal(expenses)).toBe(1800)
    expect(expenses).toHaveLength(2)
  })

  it('ignores cancelled rentals when measuring utilization', () => {
    const rows = toUtilizationRows(
      [{
        uuid: '22222222-2222-4222-8222-222222222222',
        name: 'Sony A7 IV',
        sku: 'CAM-A7IV-001',
        status: 'active',
        quantity: 2,
        damaged_quantity: 0,
        maintenance_quantity: 0,
        lost_quantity: 0,
        replacement_value: 100000,
      }],
      [
        {
          quantity: 1,
          rental_requests: { status: 'paid', starts_on: '2026-09-11', ends_on: '2026-09-13' },
          products: {
            uuid: '22222222-2222-4222-8222-222222222222',
            name: 'Sony A7 IV',
            sku: 'CAM-A7IV-001',
            status: 'active',
            quantity: 2,
            damaged_quantity: 0,
            maintenance_quantity: 0,
            lost_quantity: 0,
            replacement_value: 100000,
          },
        },
        {
          quantity: 2,
          rental_requests: { status: 'cancelled', starts_on: '2026-09-11', ends_on: '2026-09-13' },
          products: {
            uuid: '22222222-2222-4222-8222-222222222222',
            name: 'Sony A7 IV',
            sku: 'CAM-A7IV-001',
            status: 'active',
            quantity: 2,
            damaged_quantity: 0,
            maintenance_quantity: 0,
            lost_quantity: 0,
            replacement_value: 100000,
          },
        },
      ],
      '2026-09-11',
      '2026-09-13',
    )

    expect(rows[0]?.bookedUnitDays).toBe(3)
    expect(rows[0]?.capacityUnitDays).toBe(6)
    expect(rows[0]?.utilization).toBe(0.5)
    expect(rows[0]).not.toHaveProperty('id')
  })
})

describe('report charts and commissions', () => {
  const sales = [
    { uuid: 's1', paidOn: '2026-10-02', amount: 3000, currency: 'PHP', method: 'gcash', rentalUuid: null, rentalCode: 'JRY-1' },
    { uuid: 's2', paidOn: '2026-10-20', amount: 2000, currency: 'PHP', method: null, rentalUuid: null, rentalCode: 'JRY-2' },
  ]
  const expenses = [
    { uuid: 'e1', incurredOn: '2026-10-02', name: 'Internet', category: 'internet' as const, vendor: null, reference: null, amount: 1500, status: 'paid' as const },
    { uuid: 'e2', incurredOn: '2026-10-21', name: 'Commission · JRY-2', category: 'commission' as const, vendor: 'Kanna Latayada', reference: 'JRY-2', description: 'Starlink Mini · 3 days × 1', amount: 300, status: 'pending' as const },
    { uuid: 'e3', incurredOn: '2026-10-18', name: 'Commission · JRY-1', category: 'commission' as const, vendor: 'Chen Scarcetti', reference: 'JRY-1', amount: 200, status: 'paid' as const },
    { uuid: 'e4', incurredOn: '2026-10-05', name: 'Old commission', category: 'commission' as const, vendor: 'Chen Scarcetti', reference: 'JRY-1', amount: 100, status: 'void' as const },
  ]

  it('splits profit into expenses and commissions, ignoring void entries', () => {
    expect(financeSummary(sales, expenses)).toEqual({
      sales: 5000,
      otherExpenses: 1500,
      commissions: 500,
      expenses: 2000,
      profit: 3000,
      margin: 0.6,
    })
  })

  it('groups the trend by day, week, or month based on the range', () => {
    expect(reportBucketFor('2026-10-01', '2026-10-31')).toBe('day')
    expect(reportBucketFor('2026-09-01', '2026-10-31')).toBe('week')
    expect(reportBucketFor('2026-01-01', '2026-10-31')).toBe('month')

    expect(reportBuckets('2026-10-01', '2026-10-15', 'week')).toEqual([
      { label: 'Oct 1–Oct 7', startsOn: '2026-10-01', endsOn: '2026-10-07' },
      { label: 'Oct 8–Oct 14', startsOn: '2026-10-08', endsOn: '2026-10-14' },
      { label: 'Oct 15', startsOn: '2026-10-15', endsOn: '2026-10-15' },
    ])
    expect(reportBuckets('2026-09-15', '2026-10-10', 'month').map(bucket => [bucket.label, bucket.startsOn, bucket.endsOn])).toEqual([
      ['Sep 2026', '2026-09-15', '2026-09-30'],
      ['Oct 2026', '2026-10-01', '2026-10-10'],
    ])

    const weeks = toTrendPoints(sales, expenses, '2026-10-01', '2026-10-31', 'week')
    expect(weeks[0]).toMatchObject({ sales: 3000, expenses: 1500, commissions: 0, profit: 1500 })
    expect(weeks[2]).toMatchObject({ startsOn: '2026-10-15', sales: 2000, commissions: 500, profit: 1500 })
  })

  it('groups every day by month with month-end totals', () => {
    const months = toMonthGroups(sales, expenses, '2026-09-29', '2026-10-31')
    expect(months.map(group => [group.label, group.days.length])).toEqual([
      ['September 2026', 2],
      ['October 2026', 31],
    ])
    expect(months[1]!.totals).toEqual({ sales: 5000, expenses: 1500, commissions: 500, profit: 3000, margin: 0.6 })
    expect(months[0]!.totals.profit).toBe(0)

    const years = groupMonthsByYear(toMonthGroups(sales, expenses, '2025-12-30', '2026-10-31'))
    expect(years.map(year => [year.year, year.months.length])).toEqual([
      ['2025', 1],
      ['2026', 10],
    ])
    expect(years[1]!.totals).toEqual({ sales: 5000, expenses: 1500, commissions: 500, profit: 3000, margin: 0.6 })
  })

  it('lists commissions as unclaimed or collected per commissioner', () => {
    const rows = toCommissionRows(expenses)
    expect(rows.map(row => [row.commissioner, row.amount, row.status])).toEqual([
      ['Kanna Latayada', 300, 'unclaimed'],
      ['Chen Scarcetti', 200, 'collected'],
    ])
    expect(commissionsByCommissioner(rows)).toEqual([
      { name: 'Kanna Latayada', unclaimed: 300, collected: 0, count: 1 },
      { name: 'Chen Scarcetti', unclaimed: 0, collected: 200, count: 1 },
    ])
  })

  it('breaks down expenses, payment methods, and bookings', () => {
    expect(expensesByCategory(expenses).map(point => [point.label, point.value])).toEqual([
      ['internet', 1500],
      ['commission', 500],
    ])
    expect(salesByMethod(sales).map(point => point.label)).toEqual(['GCash', 'Not recorded'])
    expect(expensesByVendor(expenses).map(point => [point.label, point.value])).toEqual([
      ['No vendor', 1500],
      ['Kanna Latayada', 300],
      ['Chen Scarcetti', 200],
    ])
    expect(expenseStatusTotals(expenses)).toEqual({ paid: 1700, pending: 300, voidCount: 1 })
    expect(reportPeriodRange('this_month', '2026-10-24')).toEqual({ startsOn: '2026-10-01', endsOn: '2026-10-31' })
    expect(reportPeriodRange('last_month', '2026-01-15')).toEqual({ startsOn: '2025-12-01', endsOn: '2025-12-31' })
    expect(reportPeriodRange('last_3_months', '2026-02-10')).toEqual({ startsOn: '2025-12-01', endsOn: '2026-02-28' })
    expect(reportPeriodRange('this_year', '2026-10-24')).toEqual({ startsOn: '2026-01-01', endsOn: '2026-12-31' })

    const stats = bookingStats([
      { status: 'approved', starts_on: '2026-10-21', total_amount: 4700, rental_items: [{ quantity: 1, line_total: 4700, products: { name: 'Starlink Mini' } }] },
      { status: 'completed', starts_on: '2026-10-16', total_amount: 2700, rental_items: [{ quantity: 1, line_total: 2700, products: { name: 'Starlink Mini' } }] },
      { status: 'pending', starts_on: '2026-10-25', total_amount: 900, rental_items: [{ quantity: 1, line_total: 900, products: { name: 'Starlink Mini' } }] },
      { status: 'cancelled', starts_on: '2026-10-05', total_amount: 900, rental_items: [] },
    ], '2026-10-01', '2026-10-31')
    expect(stats).toMatchObject({ bookings: 2, bookedValue: 7400, averageBooking: 3700 })
    expect(stats.topEquipment).toEqual([{ label: 'Starlink Mini', value: 7400, count: 2 }])
    expect(stats.rentalsByStatus.map(point => [point.label, point.value])).toEqual([
      ['approved', 1],
      ['cancelled', 1],
      ['completed', 1],
      ['pending', 1],
    ])
  })
})

describe('report csv and validation', () => {
  it('quotes commas and rejects privileged query fields', () => {
    expect(toCsv(['name'], [['Sensor clean, rush']])).toBe('name\n"Sensor clean, rush"\n')
    expect(reportQuerySchema.safeParse({
      startsOn: '2026-09-01',
      endsOn: '2026-09-13',
      id: 9,
    }).success).toBe(false)
    expect(toReportCsv({
      type: 'profit',
      startsOn: '2026-09-13',
      endsOn: '2026-09-13',
      timezone: 'Asia/Manila',
      currency: 'PHP',
      summary: { sales: 10, otherExpenses: 4, commissions: 0, expenses: 4, profit: 6, margin: 0.6 },
      charts: { bucket: 'day' },
      months: [],
      rows: [{ date: '2026-09-13', sales: 10, expenses: 4, profit: 6 }],
    })).toContain('date,sales,expenses,profit')
    expect(toReportCsv({
      type: 'profit',
      startsOn: '2026-09-13',
      endsOn: '2026-09-13',
      timezone: 'Asia/Manila',
      currency: 'PHP',
      summary: { sales: 10, otherExpenses: 4, commissions: 0, expenses: 4, profit: 6, margin: 0.6 },
      charts: { bucket: 'day' },
      months: [],
      rows: [{ date: '2026-09-13', sales: 10, expenses: 4, profit: 6 }],
    })).not.toContain(',id')
  })
})
