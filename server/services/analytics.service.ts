import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminAnalytics } from '../../types/analytics'
import type { RentalStatus } from '../../utils/constants'
import { BUSINESS_TIMEZONE } from '../../utils/constants'
import { buildKpis, commissionerRanks, lastCalendarDays, rentalsByStatus, salesByDay, topRentedProducts } from '../../utils/analytics'
import { calendarDateInZone } from '../../utils/datetime'
import {
  countCustomerProfiles,
  listAnalyticsExpenses,
  listAnalyticsPayments,
  listAnalyticsRecurringExpenses,
  listAnalyticsProducts,
  listAnalyticsCommissions,
  listAnalyticsRentalItems,
  listAnalyticsRentals,
} from '../repositories/analytics.repository'

type Client = SupabaseClient<Database>

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null
  }
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getAdminAnalytics(client: Client): Promise<AdminAnalytics> {
  const [payments, rentals, expenses, recurringExpenses, products, items, commissions, customerCount] = await Promise.all([
    listAnalyticsPayments(client),
    listAnalyticsRentals(client),
    listAnalyticsExpenses(client),
    listAnalyticsRecurringExpenses(client),
    listAnalyticsProducts(client),
    listAnalyticsRentalItems(client),
    listAnalyticsCommissions(client),
    countCustomerProfiles(client),
  ])

  const today = calendarDateInZone()
  const days = lastCalendarDays(14, today)
  const topProducts = topRentedProducts(items.flatMap((item) => {
    const product = first(item.products)
    const rental = first(item.rental_requests)
    if (!product || !rental) {
      return []
    }

    return [{
      quantity: item.quantity,
      rentalStatus: rental.status as RentalStatus,
      product,
    }]
  }))

  return {
    kpis: buildKpis({
      payments,
      rentals,
      expenses,
      products,
      customerCount,
      today,
    }),
    salesByDay: salesByDay(payments, days),
    rentalsByStatus: rentalsByStatus(rentals),
    topProducts,
    commissionerRanks: commissionerRanks(commissions.flatMap((row) => {
      const commissioner = first(row.commissioner)
      if (!commissioner) {
        return []
      }

      return [{
        commissionAmount: Number(row.commission_amount),
        status: row.status as RentalStatus,
        commissioner: {
          uuid: commissioner.uuid,
          firstName: commissioner.first_name,
          lastName: commissioner.last_name,
        },
      }]
    })),
    recentExpenses: expenses.slice(0, 8).map(expense => ({
      uuid: expense.uuid,
      name: expense.name,
      amount: Number(expense.amount),
      status: expense.status,
      incurredOn: expense.incurred_on,
    })),
    recurringExpenses: recurringExpenses.map(expense => ({
      uuid: expense.uuid,
      name: expense.name,
      amount: Number(expense.amount),
      status: expense.status,
      nextOccurrenceOn: expense.next_occurrence_on,
    })),
    timezone: BUSINESS_TIMEZONE,
    asOf: today,
  }
}
