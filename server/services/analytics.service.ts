import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminAnalytics } from '../../types/analytics'
import type { RentalStatus } from '../../utils/constants'
import { BUSINESS_TIMEZONE } from '../../utils/constants'
import { buildKpis, lastCalendarDays, rentalsByStatus, salesByDay, topRentedProducts } from '../../utils/analytics'
import { calendarDateInZone } from '../../utils/datetime'
import {
  countCustomerProfiles,
  listAnalyticsExpenses,
  listAnalyticsPayments,
  listAnalyticsProducts,
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
  const [payments, rentals, expenses, products, items, customerCount] = await Promise.all([
    listAnalyticsPayments(client),
    listAnalyticsRentals(client),
    listAnalyticsExpenses(client),
    listAnalyticsProducts(client),
    listAnalyticsRentalItems(client),
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
    timezone: BUSINESS_TIMEZONE,
    asOf: today,
  }
}
