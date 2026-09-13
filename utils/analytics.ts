import type { AnalyticsKpis, AnalyticsPoint, TopProduct } from '~/types/analytics'
import type { PaymentStatus, RentalStatus } from './constants'
import { calendarDateInZone } from './datetime'

export interface AnalyticsPaymentRow {
  amount: number
  status: PaymentStatus
  paid_at: string | null
}

export interface AnalyticsRentalRow {
  status: RentalStatus
  starts_on: string
}

export interface AnalyticsExpenseRow {
  amount: number
  status: string
}

export interface AnalyticsProductRow {
  quantity: number
  replacement_value: number | null
}

export interface AnalyticsRentalItemRow {
  quantity: number
  rentalStatus: RentalStatus
  product: {
    uuid: string
    name: string
    sku: string
  }
}

export function lastCalendarDays(count: number, today: string = calendarDateInZone()): string[] {
  const [year, month, day] = today.split('-').map(Number)
  const start = Date.UTC(year, month - 1, day)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start - (count - 1 - index) * 86_400_000)
    return date.toISOString().slice(0, 10)
  })
}

export function monthStart(today: string = calendarDateInZone()): string {
  return `${today.slice(0, 7)}-01`
}

export function paidSalesOn(payments: AnalyticsPaymentRow[], startOn: string, endOn: string): number {
  return payments.reduce((sum, payment) => {
    if (payment.status !== 'paid' || !payment.paid_at) {
      return sum
    }

    const paidOn = calendarDateInZone(payment.paid_at)
    if (paidOn < startOn || paidOn > endOn) {
      return sum
    }

    return sum + Number(payment.amount)
  }, 0)
}

export function buildKpis(input: {
  payments: AnalyticsPaymentRow[]
  rentals: AnalyticsRentalRow[]
  expenses: AnalyticsExpenseRow[]
  products: AnalyticsProductRow[]
  customerCount: number
  today?: string
}): AnalyticsKpis {
  const today = input.today ?? calendarDateInZone()
  const totalSales = paidSalesOn(input.payments, '1970-01-01', today)
  const todaySales = paidSalesOn(input.payments, today, today)
  const monthSales = paidSalesOn(input.payments, monthStart(today), today)
  const totalExpenses = input.expenses
    .filter(expense => expense.status !== 'void')
    .reduce((sum, expense) => sum + Number(expense.amount), 0)

  return {
    totalSales,
    todaySales,
    monthSales,
    pendingRentals: input.rentals.filter(row => ['pending', 'awaiting_payment'].includes(row.status)).length,
    activeRentals: input.rentals.filter(row => ['active', 'overdue'].includes(row.status)).length,
    upcomingRentals: input.rentals.filter(row =>
      ['paid', 'approved', 'ready_for_pickup'].includes(row.status) && row.starts_on >= today,
    ).length,
    overdueRentals: input.rentals.filter(row => row.status === 'overdue').length,
    totalExpenses,
    netRevenue: totalSales - totalExpenses,
    totalCustomers: input.customerCount,
    inventoryValue: input.products.reduce((sum, product) => (
      sum + Number(product.quantity) * Number(product.replacement_value ?? 0)
    ), 0),
  }
}

export function salesByDay(payments: AnalyticsPaymentRow[], days: string[]): AnalyticsPoint[] {
  return days.map(label => ({
    label,
    value: paidSalesOn(payments, label, label),
  }))
}

export function rentalsByStatus(rentals: AnalyticsRentalRow[]): AnalyticsPoint[] {
  const counts = new Map<string, number>()
  for (const rental of rentals) {
    counts.set(rental.status, (counts.get(rental.status) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({ label, value }))
}

export function topRentedProducts(items: AnalyticsRentalItemRow[], limit = 5): TopProduct[] {
  const totals = new Map<string, TopProduct>()

  for (const item of items) {
    if (['draft', 'cancelled', 'rejected'].includes(item.rentalStatus)) {
      continue
    }

    const current = totals.get(item.product.uuid) ?? {
      uuid: item.product.uuid,
      name: item.product.name,
      sku: item.product.sku,
      quantity: 0,
    }
    current.quantity += item.quantity
    totals.set(item.product.uuid, current)
  }

  return [...totals.values()]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, limit)
}
