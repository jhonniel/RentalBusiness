import type { ExpenseCategory, ExpenseStatus, RentalStatus } from '~/utils/constants'

export const REPORT_TYPES = [
  'overview',
  'sales',
  'expenses',
  'commissions',
  'profit',
  'rentals',
  'inventory',
  'utilization',
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export interface ReportMeta {
  type: ReportType
  startsOn: string
  endsOn: string
  timezone: string
  currency: string
}

export interface SalesReportRow {
  uuid: string
  paidOn: string
  amount: number
  currency: string
  method: string | null
  rentalUuid: string | null
  rentalCode: string | null
}

export interface ExpenseReportRow {
  uuid: string
  incurredOn: string
  name: string
  category: ExpenseCategory
  vendor: string | null
  reference: string | null
  description?: string | null
  amount: number
  status: ExpenseStatus
}

export interface ProfitReportRow {
  date: string
  sales: number
  expenses: number
  profit: number
}

export interface RentalReportRow {
  uuid: string
  code: string
  status: RentalStatus
  startsOn: string
  endsOn: string
  totalAmount: number
  customerName: string | null
}

export interface InventoryReportRow {
  uuid: string
  name: string
  sku: string
  status: string
  quantity: number
  rentable: number
  replacementValue: number
  inventoryValue: number
}

export interface UtilizationReportRow {
  uuid: string
  name: string
  sku: string
  bookedUnitDays: number
  capacityUnitDays: number
  utilization: number
}

export type ReportBucket = 'day' | 'week' | 'month'

export interface ReportTrendPoint {
  label: string
  startsOn: string
  endsOn: string
  sales: number
  expenses: number
  commissions: number
  profit: number
}

export interface ReportMonthGroup {
  month: string
  label: string
  startsOn: string
  endsOn: string
  days: ReportTrendPoint[]
  totals: {
    sales: number
    expenses: number
    commissions: number
    profit: number
    margin: number
  }
}

export interface ReportBreakdownPoint {
  label: string
  value: number
  count: number
}

export interface ReportCommissionerPoint {
  name: string
  unclaimed: number
  collected: number
  count: number
}

export interface ReportBarItem {
  label: string
  hint?: string
  segments: Array<{ value: number, class: string }>
}

export interface ReportCharts {
  bucket: ReportBucket
  trend?: ReportTrendPoint[]
  expensesByCategory?: ReportBreakdownPoint[]
  expensesByVendor?: ReportBreakdownPoint[]
  salesByMethod?: ReportBreakdownPoint[]
  commissionsByCommissioner?: ReportCommissionerPoint[]
  topEquipment?: ReportBreakdownPoint[]
  rentalsByStatus?: ReportBreakdownPoint[]
}

export interface FinanceSummary {
  sales: number
  otherExpenses: number
  commissions: number
  expenses: number
  profit: number
  margin: number
}

export interface CommissionReportRow {
  uuid: string
  incurredOn: string
  commissioner: string
  rentalCode: string | null
  description: string | null
  amount: number
  status: 'unclaimed' | 'collected'
}

export type AdminReport
  = | (ReportMeta & {
    type: 'overview'
    summary: FinanceSummary & {
      paidCount: number
      bookings: number
      bookedValue: number
      averageBooking: number
      unclaimedCommissions: number
      collectedCommissions: number
    }
    charts: ReportCharts
    months: ReportMonthGroup[]
    rows: ReportTrendPoint[]
  })
  | (ReportMeta & {
    type: 'sales'
    summary: { count: number, total: number, average: number }
    charts: ReportCharts
    rows: SalesReportRow[]
  })
  | (ReportMeta & {
    type: 'expenses'
    summary: { count: number, total: number, commissions: number, otherExpenses: number, paid: number, pending: number, voidCount: number }
    charts: ReportCharts
    rows: ExpenseReportRow[]
  })
  | (ReportMeta & {
    type: 'commissions'
    summary: { count: number, total: number, unclaimed: number, collected: number }
    charts: ReportCharts
    rows: CommissionReportRow[]
  })
  | (ReportMeta & {
    type: 'profit'
    summary: FinanceSummary
    charts: ReportCharts
    months: ReportMonthGroup[]
    rows: ProfitReportRow[]
  })
  | (ReportMeta & {
    type: 'rentals'
    summary: { count: number, totalAmount: number }
    rows: RentalReportRow[]
  })
  | (ReportMeta & {
    type: 'inventory'
    summary: { count: number, inventoryValue: number, rentableUnits: number }
    rows: InventoryReportRow[]
  })
  | (ReportMeta & {
    type: 'utilization'
    summary: { bookedUnitDays: number, capacityUnitDays: number, utilization: number }
    rows: UtilizationReportRow[]
  })
