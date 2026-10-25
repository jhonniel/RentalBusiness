import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminReport, ReportType } from '../../types/report'
import type { ReportQuery } from '../../utils/report-validation'
import { calendarDateInZone } from '../../utils/datetime'
import { monthStart } from '../../utils/analytics'
import {
  bookingStats,
  commissionsByCommissioner,
  expensesByCategory,
  expensesByVendor,
  expenseStatusTotals,
  financeSummary,
  reportBucketFor,
  reportFilename,
  reportMeta,
  salesByMethod,
  toCommissionRows,
  toExpenseRows,
  toInventoryRows,
  toActualMonths,
  toActualTrend,
  toMonthGroups,
  toProfitRows,
  toRentalRows,
  toReportCsv,
  toSalesRows,
  toTrendPoints,
  toUtilizationRows,
} from '../../utils/report'
import { recordAudit } from '../utils/audit'
import {
  listReportBookings,
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
  const bucket = reportBucketFor(startsOn, endsOn)

  if (type === 'overview') {
    const [payments, expenses, bookings] = await Promise.all([
      listReportPayments(client),
      listReportExpenses(client, startsOn, endsOn),
      listReportBookings(client, startsOn, endsOn),
    ])
    const sales = toSalesRows(payments, startsOn, endsOn)
    const expenseRows = toExpenseRows(expenses, startsOn, endsOn)
    const commissionRows = toCommissionRows(expenseRows)
    const stats = bookingStats(bookings, startsOn, endsOn)
    const trend = toActualTrend(toTrendPoints(sales, expenseRows, startsOn, endsOn, bucket))
    return {
      ...meta,
      type,
      summary: {
        ...financeSummary(sales, expenseRows),
        paidCount: sales.length,
        bookings: stats.bookings,
        bookedValue: stats.bookedValue,
        averageBooking: stats.averageBooking,
        unclaimedCommissions: commissionRows.filter(row => row.status === 'unclaimed').reduce((sum, row) => sum + row.amount, 0),
        collectedCommissions: commissionRows.filter(row => row.status === 'collected').reduce((sum, row) => sum + row.amount, 0),
      },
      charts: {
        bucket,
        trend,
        expensesByCategory: expensesByCategory(expenseRows),
        salesByMethod: salesByMethod(sales),
        commissionsByCommissioner: commissionsByCommissioner(commissionRows),
        topEquipment: stats.topEquipment,
        rentalsByStatus: stats.rentalsByStatus,
      },
      months: toActualMonths(toMonthGroups(sales, expenseRows, startsOn, endsOn)),
      rows: trend,
    }
  }

  if (type === 'sales') {
    const [payments, expenses] = await Promise.all([
      listReportPayments(client),
      listReportExpenses(client, startsOn, endsOn),
    ])
    const rows = toSalesRows(payments, startsOn, endsOn)
    const commissionRows = toExpenseRows(expenses, startsOn, endsOn).filter(row => row.category === 'commission')
    const totals = financeSummary(rows, commissionRows)
    const total = Math.round((totals.sales - totals.commissions) * 100) / 100
    return {
      ...meta,
      type,
      summary: {
        count: rows.length,
        total,
        average: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0,
        paid: Math.round(rows.reduce((sum, row) => sum + (row.paidAmount ?? row.amount), 0) * 100) / 100,
        depositsHeld: Math.round(rows.reduce((sum, row) => sum + (row.depositHeld ?? 0), 0) * 100) / 100,
        commissions: totals.commissions,
      },
      charts: {
        bucket,
        trend: toTrendPoints(rows, commissionRows, startsOn, endsOn, bucket).map(point => ({
          ...point,
          sales: Math.round((point.sales - point.commissions) * 100) / 100,
        })),
        salesByMethod: salesByMethod(rows),
      },
      rows,
    }
  }

  if (type === 'expenses') {
    const rows = toExpenseRows(await listReportExpenses(client, startsOn, endsOn), startsOn, endsOn)
    const totals = financeSummary([], rows)
    return {
      ...meta,
      type,
      summary: {
        count: rows.length,
        total: totals.expenses,
        commissions: totals.commissions,
        otherExpenses: totals.otherExpenses,
        ...expenseStatusTotals(rows),
      },
      charts: {
        bucket,
        trend: toTrendPoints([], rows, startsOn, endsOn, bucket),
        expensesByCategory: expensesByCategory(rows),
        expensesByVendor: expensesByVendor(rows),
      },
      rows,
    }
  }

  if (type === 'commissions') {
    const rows = toCommissionRows(toExpenseRows(await listReportExpenses(client, startsOn, endsOn), startsOn, endsOn))
    const unclaimed = rows.filter(row => row.status === 'unclaimed').reduce((sum, row) => sum + row.amount, 0)
    const collected = rows.filter(row => row.status === 'collected').reduce((sum, row) => sum + row.amount, 0)
    return {
      ...meta,
      type,
      summary: { count: rows.length, total: unclaimed + collected, unclaimed, collected },
      charts: {
        bucket,
        commissionsByCommissioner: commissionsByCommissioner(rows),
      },
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
    return {
      ...meta,
      type,
      summary: financeSummary(sales, expenseRows),
      charts: {
        bucket,
        trend: toActualTrend(toTrendPoints(sales, expenseRows, startsOn, endsOn, bucket)),
      },
      months: toActualMonths(toMonthGroups(sales, expenseRows, startsOn, endsOn)),
      rows: toProfitRows(sales, expenseRows, startsOn, endsOn),
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
