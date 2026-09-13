import type { ExpenseCategory, ExpenseStatus, RentalStatus } from '~/utils/constants'

export const REPORT_TYPES = [
  'sales',
  'expenses',
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

export type AdminReport
  = | (ReportMeta & {
    type: 'sales'
    summary: { count: number, total: number }
    rows: SalesReportRow[]
  })
  | (ReportMeta & {
    type: 'expenses'
    summary: { count: number, total: number }
    rows: ExpenseReportRow[]
  })
  | (ReportMeta & {
    type: 'profit'
    summary: { sales: number, expenses: number, profit: number }
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
