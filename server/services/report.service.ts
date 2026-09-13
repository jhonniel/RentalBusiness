import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminReport, ReportType } from '../../types/report'
import type { ReportQuery } from '../../utils/report-validation'
import { calendarDateInZone } from '../../utils/datetime'
import { monthStart } from '../../utils/analytics'
import {
  expenseTotal,
  reportFilename,
  reportMeta,
  toExpenseRows,
  toInventoryRows,
  toProfitRows,
  toRentalRows,
  toReportCsv,
  toSalesRows,
  toUtilizationRows,
} from '../../utils/report'
import { recordAudit } from '../utils/audit'
import {
  listReportExpenses,
  listReportPayments,
  listReportProducts,
  listReportRentals,
  listReportUtilizationItems,
} from '../repositories/report.repository'

type Client = SupabaseClient<Database>

function range(query: ReportQuery) {
  const today = calendarDateInZone()
  return {
    startsOn: query.startsOn || monthStart(today),
    endsOn: query.endsOn || today,
  }
}

export async function getAdminReport(client: Client, type: ReportType, query: ReportQuery): Promise<AdminReport> {
  const { startsOn, endsOn } = range(query)
  const meta = reportMeta(type, startsOn, endsOn)

  if (type === 'sales') {
    const rows = toSalesRows(await listReportPayments(client), startsOn, endsOn)
    return {
      ...meta,
      type,
      summary: { count: rows.length, total: rows.reduce((sum, row) => sum + row.amount, 0) },
      rows,
    }
  }

  if (type === 'expenses') {
    const rows = toExpenseRows(await listReportExpenses(client, startsOn, endsOn), startsOn, endsOn)
    return {
      ...meta,
      type,
      summary: { count: rows.length, total: expenseTotal(rows) },
      rows,
    }
  }

  if (type === 'profit') {
    const [payments, expenses] = await Promise.all([
      listReportPayments(client),
      listReportExpenses(client, startsOn, endsOn),
    ])
    const sales = toSalesRows(payments, startsOn, endsOn)
    const expenseRows = toExpenseRows(expenses, startsOn, endsOn)
    const rows = toProfitRows(sales, expenseRows, startsOn, endsOn)
    const salesTotal = sales.reduce((sum, row) => sum + row.amount, 0)
    const expensesTotal = expenseTotal(expenseRows)
    return {
      ...meta,
      type,
      summary: { sales: salesTotal, expenses: expensesTotal, profit: salesTotal - expensesTotal },
      rows,
    }
  }

  if (type === 'rentals') {
    const rows = toRentalRows(await listReportRentals(client, startsOn, endsOn), startsOn, endsOn)
    return {
      ...meta,
      type,
      summary: { count: rows.length, totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0) },
      rows,
    }
  }

  if (type === 'inventory') {
    const rows = toInventoryRows(await listReportProducts(client))
    return {
      ...meta,
      type,
      summary: {
        count: rows.length,
        inventoryValue: rows.reduce((sum, row) => sum + row.inventoryValue, 0),
        rentableUnits: rows.reduce((sum, row) => sum + row.rentable, 0),
      },
      rows,
    }
  }

  const [products, items] = await Promise.all([
    listReportProducts(client),
    listReportUtilizationItems(client),
  ])
  const rows = toUtilizationRows(products, items, startsOn, endsOn)
  const bookedUnitDays = rows.reduce((sum, row) => sum + row.bookedUnitDays, 0)
  const capacityUnitDays = rows.reduce((sum, row) => sum + row.capacityUnitDays, 0)
  return {
    ...meta,
    type: 'utilization',
    summary: {
      bookedUnitDays,
      capacityUnitDays,
      utilization: capacityUnitDays === 0 ? 0 : Number((bookedUnitDays / capacityUnitDays).toFixed(4)),
    },
    rows,
  }
}

export async function exportAdminReport(
  event: H3Event,
  client: Client,
  type: ReportType,
  query: ReportQuery,
) {
  const report = await getAdminReport(client, type, query)
  const filename = reportFilename(report.type, report.startsOn, report.endsOn)
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  await recordAudit(event, client, {
    action: 'report.export',
    entity: 'reports',
    entityId: report.type,
    next: { startsOn: report.startsOn, endsOn: report.endsOn, format: 'csv' },
  })
  return toReportCsv(report)
}
