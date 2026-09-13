import type {
  AdminReport,
  ExpenseReportRow,
  InventoryReportRow,
  ProfitReportRow,
  RentalReportRow,
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

export function reportFilename(type: AdminReport['type'], startsOn: string, endsOn: string): string {
  return `lumen-${type}-${startsOn}-${endsOn}.csv`
}

export function toReportCsv(report: AdminReport): string {
  switch (report.type) {
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
