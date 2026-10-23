import type {
  AdminReport,
  CommissionReportRow,
  ExpenseReportRow,
  FinanceSummary,
  InventoryReportRow,
  ProfitReportRow,
  RentalReportRow,
  ReportBreakdownPoint,
  ReportBucket,
  ReportCommissionerPoint,
  ReportMonthGroup,
  ReportTrendPoint,
  SalesReportRow,
  UtilizationReportRow,
} from '~/types/report'
import type { ExpenseStatus, PaymentStatus, RentalStatus } from './constants'
import { BUSINESS_CURRENCY, BUSINESS_TIMEZONE } from './constants'
import { calendarDateInZone, inclusiveDayCount, overlapDayCount } from './datetime'
import { addCalendarDays } from './expense'
import { rentableCapacity } from './availability'
import { rentalOccupiesInventory } from './rental-status'
import { toCsv } from './csv'

export const REPORT_RANGE_MAX_DAYS = 366

export interface ReportPaymentRow {
  uuid: string
  amount: number
  currency: string
  status: PaymentStatus
  payment_method: string | null
  paid_at: string | null
  rental_requests?: {
    uuid: string
    code: string
  } | {
    uuid: string
    code: string
  }[] | null
}

export interface ReportExpenseRow {
  uuid: string
  name: string
  category: ExpenseReportRow['category']
  vendor: string | null
  reference: string | null
  description?: string | null
  amount: number
  status: ExpenseStatus
  incurred_on: string
}

export interface ReportRentalRow {
  uuid: string
  code: string
  status: RentalStatus
  starts_on: string
  ends_on: string
  total_amount: number
  profiles?: {
    first_name: string
    last_name: string
  } | {
    first_name: string
    last_name: string
  }[] | null
}

export interface ReportProductRow {
  uuid: string
  name: string
  sku: string
  status: string
  quantity: number
  damaged_quantity: number
  maintenance_quantity: number
  lost_quantity: number
  replacement_value: number | null
}

export interface ReportUtilizationItemRow {
  quantity: number
  rental_requests?: {
    status: RentalStatus
    starts_on: string
    ends_on: string
  } | {
    status: RentalStatus
    starts_on: string
    ends_on: string
  }[] | null
  products?: ReportProductRow | ReportProductRow[] | null
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null
  }
  return Array.isArray(value) ? value[0] ?? null : value
}

export function calendarRange(startsOn: string, endsOn: string): string[] {
  const days = inclusiveDayCount(startsOn, endsOn)
  return Array.from({ length: days }, (_, index) => addCalendarDays(startsOn, index))
}

export function inCalendarRange(value: string, startsOn: string, endsOn: string): boolean {
  return value >= startsOn && value <= endsOn
}

export function toSalesRows(payments: ReportPaymentRow[], startsOn: string, endsOn: string): SalesReportRow[] {
  return payments.flatMap((payment) => {
    if (payment.status !== 'paid' || !payment.paid_at) {
      return []
    }

    const paidOn = calendarDateInZone(payment.paid_at)
    if (!inCalendarRange(paidOn, startsOn, endsOn)) {
      return []
    }

    const rental = first(payment.rental_requests)
    return [{
      uuid: payment.uuid,
      paidOn,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.payment_method,
      rentalUuid: rental?.uuid ?? null,
      rentalCode: rental?.code ?? null,
    }]
  })
}

export function toExpenseRows(expenses: ReportExpenseRow[], startsOn: string, endsOn: string): ExpenseReportRow[] {
  return expenses
    .filter(expense => inCalendarRange(expense.incurred_on, startsOn, endsOn))
    .map(expense => ({
      uuid: expense.uuid,
      incurredOn: expense.incurred_on,
      name: expense.name,
      category: expense.category,
      vendor: expense.vendor,
      reference: expense.reference,
      description: expense.description ?? null,
      amount: Number(expense.amount),
      status: expense.status,
    }))
}

export function expenseTotal(rows: ExpenseReportRow[]): number {
  return rows
    .filter(row => row.status !== 'void')
    .reduce((sum, row) => sum + row.amount, 0)
}

export function toProfitRows(sales: SalesReportRow[], expenses: ExpenseReportRow[], startsOn: string, endsOn: string): ProfitReportRow[] {
  return calendarRange(startsOn, endsOn).map((date) => {
    const daySales = sales.filter(row => row.paidOn === date).reduce((sum, row) => sum + row.amount, 0)
    const dayExpenses = expenseTotal(expenses.filter(row => row.incurredOn === date))
    return {
      date,
      sales: daySales,
      expenses: dayExpenses,
      profit: daySales - dayExpenses,
    }
  })
}

export function toRentalRows(rentals: ReportRentalRow[], startsOn: string, endsOn: string): RentalReportRow[] {
  return rentals
    .filter(rental => overlapDayCount(rental.starts_on, rental.ends_on, startsOn, endsOn) > 0)
    .map((rental) => {
      const customer = first(rental.profiles)
      return {
        uuid: rental.uuid,
        code: rental.code,
        status: rental.status,
        startsOn: rental.starts_on,
        endsOn: rental.ends_on,
        totalAmount: Number(rental.total_amount),
        customerName: customer ? `${customer.first_name} ${customer.last_name}`.trim() : null,
      }
    })
}

export function toInventoryRows(products: ReportProductRow[]): InventoryReportRow[] {
  return products
    .filter(product => product.status !== 'archived')
    .map((product) => {
      const rentable = rentableCapacity({
        quantity: product.quantity,
        damagedQuantity: product.damaged_quantity,
        maintenanceQuantity: product.maintenance_quantity,
        lostQuantity: product.lost_quantity,
      })
      const replacementValue = Number(product.replacement_value ?? 0)
      return {
        uuid: product.uuid,
        name: product.name,
        sku: product.sku,
        status: product.status,
        quantity: product.quantity,
        rentable,
        replacementValue,
        inventoryValue: product.quantity * replacementValue,
      }
    })
}

export function toUtilizationRows(
  products: ReportProductRow[],
  items: ReportUtilizationItemRow[],
  startsOn: string,
  endsOn: string,
): UtilizationReportRow[] {
  const rangeDays = inclusiveDayCount(startsOn, endsOn)
  const booked = new Map<string, number>()

  for (const item of items) {
    const product = first(item.products)
    const rental = first(item.rental_requests)
    if (!product || !rental || product.status === 'archived' || !rentalOccupiesInventory(rental.status)) {
      continue
    }

    const days = overlapDayCount(rental.starts_on, rental.ends_on, startsOn, endsOn)
    booked.set(product.uuid, (booked.get(product.uuid) ?? 0) + item.quantity * days)
  }

  return toInventoryRows(products).map((product) => {
    const bookedUnitDays = booked.get(product.uuid) ?? 0
    const capacityUnitDays = product.rentable * rangeDays
    return {
      uuid: product.uuid,
      name: product.name,
      sku: product.sku,
      bookedUnitDays,
      capacityUnitDays,
      utilization: capacityUnitDays === 0 ? 0 : Number((bookedUnitDays / capacityUnitDays).toFixed(4)),
    }
  })
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(date: string) {
  return `${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export const REPORT_PERIODS = ['this_month', 'last_month', 'last_3_months', 'this_year'] as const
export type ReportPeriod = (typeof REPORT_PERIODS)[number]

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  this_year: 'This year',
}

export function reportPeriodRange(period: ReportPeriod, today: string = calendarDateInZone()) {
  const [year, month] = today.split('-').map(Number) as [number, number]
  const monthStartOf = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
  const monthEndOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  if (period === 'last_month') {
    return { startsOn: monthStartOf(year, month - 1), endsOn: monthEndOf(year, month - 1) }
  }
  if (period === 'last_3_months') {
    return { startsOn: monthStartOf(year, month - 2), endsOn: monthEndOf(year, month) }
  }
  if (period === 'this_year') {
    return { startsOn: `${year}-01-01`, endsOn: `${year}-12-31` }
  }
  return { startsOn: monthStartOf(year, month), endsOn: monthEndOf(year, month) }
}

export function reportBucketFor(startsOn: string, endsOn: string): ReportBucket {
  const days = inclusiveDayCount(startsOn, endsOn)
  if (days <= 31) {
    return 'day'
  }
  return days <= 98 ? 'week' : 'month'
}

export function reportBuckets(startsOn: string, endsOn: string, bucket: ReportBucket = reportBucketFor(startsOn, endsOn)) {
  if (bucket === 'day') {
    return calendarRange(startsOn, endsOn).map(date => ({ label: shortDate(date), startsOn: date, endsOn: date }))
  }

  const buckets: Array<{ label: string, startsOn: string, endsOn: string }> = []
  let start = startsOn
  while (start && start <= endsOn) {
    let end: string
    let label: string
    if (bucket === 'week') {
      end = addCalendarDays(start, 6)
      end = end > endsOn ? endsOn : end
      label = start === end ? shortDate(start) : `${shortDate(start)}–${shortDate(end)}`
    }
    else {
      const [year, month] = start.split('-').map(Number)
      const monthEnd = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10)
      end = monthEnd > endsOn ? endsOn : monthEnd
      label = `${MONTH_NAMES[month! - 1]} ${year}`
    }
    buckets.push({ label, startsOn: start, endsOn: end })
    start = addCalendarDays(end, 1)
  }
  return buckets
}

function activeExpenses(rows: ExpenseReportRow[]) {
  return rows.filter(row => row.status !== 'void')
}

export function financeSummary(sales: SalesReportRow[], expenses: ExpenseReportRow[]): FinanceSummary {
  const salesTotal = roundMoney(sales.reduce((sum, row) => sum + row.amount, 0))
  const active = activeExpenses(expenses)
  const commissions = roundMoney(active.filter(row => row.category === 'commission').reduce((sum, row) => sum + row.amount, 0))
  const otherExpenses = roundMoney(active.filter(row => row.category !== 'commission').reduce((sum, row) => sum + row.amount, 0))
  const total = roundMoney(commissions + otherExpenses)
  const profit = roundMoney(salesTotal - total)
  return {
    sales: salesTotal,
    otherExpenses,
    commissions,
    expenses: total,
    profit,
    margin: salesTotal > 0 ? Number((profit / salesTotal).toFixed(4)) : 0,
  }
}

export function toTrendPoints(
  sales: SalesReportRow[],
  expenses: ExpenseReportRow[],
  startsOn: string,
  endsOn: string,
  bucket: ReportBucket = reportBucketFor(startsOn, endsOn),
): ReportTrendPoint[] {
  return reportBuckets(startsOn, endsOn, bucket).map((range) => {
    const totals = financeSummary(
      sales.filter(row => inCalendarRange(row.paidOn, range.startsOn, range.endsOn)),
      expenses.filter(row => inCalendarRange(row.incurredOn, range.startsOn, range.endsOn)),
    )
    return {
      ...range,
      sales: totals.sales,
      expenses: totals.otherExpenses,
      commissions: totals.commissions,
      profit: totals.profit,
    }
  })
}

const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function toMonthGroups(
  sales: SalesReportRow[],
  expenses: ExpenseReportRow[],
  startsOn: string,
  endsOn: string,
): ReportMonthGroup[] {
  const groups: ReportMonthGroup[] = []
  for (const day of toTrendPoints(sales, expenses, startsOn, endsOn, 'day')) {
    const month = day.startsOn.slice(0, 7)
    let group = groups[groups.length - 1]
    if (!group || group.month !== month) {
      group = {
        month,
        label: `${FULL_MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
        startsOn: day.startsOn,
        endsOn: day.endsOn,
        days: [],
        totals: { sales: 0, expenses: 0, commissions: 0, profit: 0, margin: 0 },
      }
      groups.push(group)
    }
    group.days.push(day)
    group.endsOn = day.endsOn
    group.totals.sales = roundMoney(group.totals.sales + day.sales)
    group.totals.expenses = roundMoney(group.totals.expenses + day.expenses)
    group.totals.commissions = roundMoney(group.totals.commissions + day.commissions)
    group.totals.profit = roundMoney(group.totals.profit + day.profit)
  }

  for (const group of groups) {
    group.totals.margin = group.totals.sales > 0 ? Number((group.totals.profit / group.totals.sales).toFixed(4)) : 0
  }
  return groups
}

export function groupMonthsByYear(months: ReportMonthGroup[]) {
  const years: Array<{ year: string, months: ReportMonthGroup[], totals: ReportMonthGroup['totals'] }> = []
  for (const month of months) {
    const year = month.month.slice(0, 4)
    let group = years[years.length - 1]
    if (!group || group.year !== year) {
      group = { year, months: [], totals: { sales: 0, expenses: 0, commissions: 0, profit: 0, margin: 0 } }
      years.push(group)
    }
    group.months.push(month)
    group.totals.sales = roundMoney(group.totals.sales + month.totals.sales)
    group.totals.expenses = roundMoney(group.totals.expenses + month.totals.expenses)
    group.totals.commissions = roundMoney(group.totals.commissions + month.totals.commissions)
    group.totals.profit = roundMoney(group.totals.profit + month.totals.profit)
  }

  for (const group of years) {
    group.totals.margin = group.totals.sales > 0 ? Number((group.totals.profit / group.totals.sales).toFixed(4)) : 0
  }
  return years
}

function breakdown(entries: Array<{ label: string, value: number }>): ReportBreakdownPoint[] {
  const groups = new Map<string, ReportBreakdownPoint>()
  for (const entry of entries) {
    const group = groups.get(entry.label) ?? { label: entry.label, value: 0, count: 0 }
    group.value = roundMoney(group.value + entry.value)
    group.count += 1
    groups.set(entry.label, group)
  }
  return [...groups.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

export function expensesByCategory(expenses: ExpenseReportRow[]) {
  return breakdown(activeExpenses(expenses).map(row => ({ label: row.category, value: row.amount })))
}

export function expensesByVendor(expenses: ExpenseReportRow[], limit = 6) {
  return breakdown(activeExpenses(expenses).map(row => ({ label: row.vendor?.trim() || 'No vendor', value: row.amount }))).slice(0, limit)
}

export function expenseStatusTotals(expenses: ExpenseReportRow[]) {
  const active = activeExpenses(expenses)
  return {
    paid: roundMoney(active.filter(row => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0)),
    pending: roundMoney(active.filter(row => row.status === 'pending').reduce((sum, row) => sum + row.amount, 0)),
    voidCount: expenses.length - active.length,
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank transfer',
}

export function paymentMethodLabel(method: string | null) {
  if (!method) {
    return 'Not recorded'
  }
  return PAYMENT_METHOD_LABELS[method.toLowerCase()] ?? method.replaceAll('_', ' ')
}

export function salesByMethod(sales: SalesReportRow[]) {
  return breakdown(sales.map(row => ({ label: paymentMethodLabel(row.method), value: row.amount })))
}

export function toCommissionRows(expenses: ExpenseReportRow[]): CommissionReportRow[] {
  return activeExpenses(expenses)
    .filter(row => row.category === 'commission')
    .map(row => ({
      uuid: row.uuid,
      incurredOn: row.incurredOn,
      commissioner: row.vendor || 'Commissioner',
      rentalCode: row.reference,
      description: row.description ?? null,
      amount: row.amount,
      status: row.status === 'paid' ? 'collected' as const : 'unclaimed' as const,
    }))
}

export function commissionsByCommissioner(rows: CommissionReportRow[]): ReportCommissionerPoint[] {
  const groups = new Map<string, ReportCommissionerPoint>()
  for (const row of rows) {
    const group = groups.get(row.commissioner) ?? { name: row.commissioner, unclaimed: 0, collected: 0, count: 0 }
    group[row.status === 'collected' ? 'collected' : 'unclaimed'] = roundMoney(group[row.status === 'collected' ? 'collected' : 'unclaimed'] + row.amount)
    group.count += 1
    groups.set(row.commissioner, group)
  }
  return [...groups.values()].sort((a, b) => (b.unclaimed + b.collected) - (a.unclaimed + a.collected))
}

export interface ReportBookingRow {
  status: RentalStatus
  starts_on: string
  total_amount: number
  rental_items?: Array<{
    quantity: number
    line_total: number
    products?: { name: string } | { name: string }[] | null
  }> | null
}

export const REPORT_BOOKED_STATUSES: readonly RentalStatus[] = ['paid', 'approved', 'ready_for_pickup', 'active', 'overdue', 'returned', 'completed']

export function bookingStats(rows: ReportBookingRow[], startsOn: string, endsOn: string) {
  const inRange = rows.filter(row => row.status !== 'draft' && inCalendarRange(row.starts_on, startsOn, endsOn))
  const booked = inRange.filter(row => REPORT_BOOKED_STATUSES.includes(row.status))
  const bookedValue = roundMoney(booked.reduce((sum, row) => sum + Number(row.total_amount), 0))

  return {
    bookings: booked.length,
    bookedValue,
    averageBooking: booked.length ? roundMoney(bookedValue / booked.length) : 0,
    topEquipment: breakdown(booked.flatMap(row => (row.rental_items ?? []).map(item => ({
      label: first(item.products)?.name || 'Equipment',
      value: Number(item.line_total),
    })))).slice(0, 8),
    rentalsByStatus: breakdown(inRange.map(row => ({ label: row.status, value: 1 }))),
  }
}

export function reportFilename(type: AdminReport['type'], startsOn: string, endsOn: string): string {
  return `lumen-${type}-${startsOn}-${endsOn}.csv`
}

export function toReportCsv(report: AdminReport): string {
  switch (report.type) {
    case 'overview':
      return toCsv(
        ['period', 'startsOn', 'endsOn', 'sales', 'expenses', 'commissions', 'profit'],
        report.rows.map(row => [row.label, row.startsOn, row.endsOn, row.sales, row.expenses, row.commissions, row.profit]),
      )
    case 'commissions':
      return toCsv(
        ['incurredOn', 'commissioner', 'rentalCode', 'description', 'amount', 'status', 'uuid'],
        report.rows.map(row => [row.incurredOn, row.commissioner, row.rentalCode, row.description, row.amount, row.status, row.uuid]),
      )
    case 'sales':
      return toCsv(
        ['paidOn', 'amount', 'currency', 'method', 'rentalCode', 'uuid'],
        report.rows.map(row => [row.paidOn, row.amount, row.currency, row.method, row.rentalCode, row.uuid]),
      )
    case 'expenses':
      return toCsv(
        ['incurredOn', 'name', 'category', 'vendor', 'reference', 'amount', 'status', 'uuid'],
        report.rows.map(row => [row.incurredOn, row.name, row.category, row.vendor, row.reference, row.amount, row.status, row.uuid]),
      )
    case 'profit':
      return toCsv(
        ['date', 'sales', 'expenses', 'profit'],
        report.rows.map(row => [row.date, row.sales, row.expenses, row.profit]),
      )
    case 'rentals':
      return toCsv(
        ['code', 'status', 'startsOn', 'endsOn', 'totalAmount', 'customerName', 'uuid'],
        report.rows.map(row => [row.code, row.status, row.startsOn, row.endsOn, row.totalAmount, row.customerName, row.uuid]),
      )
    case 'inventory':
      return toCsv(
        ['name', 'sku', 'status', 'quantity', 'rentable', 'replacementValue', 'inventoryValue', 'uuid'],
        report.rows.map(row => [row.name, row.sku, row.status, row.quantity, row.rentable, row.replacementValue, row.inventoryValue, row.uuid]),
      )
    case 'utilization':
      return toCsv(
        ['name', 'sku', 'bookedUnitDays', 'capacityUnitDays', 'utilization', 'uuid'],
        report.rows.map(row => [row.name, row.sku, row.bookedUnitDays, row.capacityUnitDays, row.utilization, row.uuid]),
      )
  }
}

export function reportMeta(type: AdminReport['type'], startsOn: string, endsOn: string) {
  return {
    type,
    startsOn,
    endsOn,
    timezone: BUSINESS_TIMEZONE,
    currency: BUSINESS_CURRENCY,
  }
}
