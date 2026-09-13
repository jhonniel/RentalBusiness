import { describe, expect, it } from 'vitest'
import { inclusiveDayCount, overlapDayCount } from '../../utils/datetime'
import { toCsv } from '../../utils/csv'
import {
  expenseTotal,
  toExpenseRows,
  toReportCsv,
  toSalesRows,
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
      summary: { sales: 10, expenses: 4, profit: 6 },
      rows: [{ date: '2026-09-13', sales: 10, expenses: 4, profit: 6 }],
    })).toContain('date,sales,expenses,profit')
    expect(toReportCsv({
      type: 'profit',
      startsOn: '2026-09-13',
      endsOn: '2026-09-13',
      timezone: 'Asia/Manila',
      currency: 'PHP',
      summary: { sales: 10, expenses: 4, profit: 6 },
      rows: [{ date: '2026-09-13', sales: 10, expenses: 4, profit: 6 }],
    })).not.toContain(',id')
  })
})
