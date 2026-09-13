import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function listAnalyticsPayments(client: Client) {
  const { data, error } = await client
    .from('payment_transactions')
    .select('amount, status, paid_at')
    .eq('status', 'paid')

  if (error) {
    throw new AppError('We could not load sales.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listAnalyticsRentals(client: Client) {
  const { data, error } = await client
    .from('rental_requests')
    .select('status, starts_on')

  if (error) {
    throw new AppError('We could not load rentals.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listAnalyticsExpenses(client: Client) {
  const { data, error } = await client
    .from('expenses')
    .select('amount, status')

  if (error) {
    throw new AppError('We could not load expenses.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listAnalyticsProducts(client: Client) {
  const { data, error } = await client
    .from('products')
    .select('quantity, replacement_value')
    .neq('status', 'archived')

  if (error) {
    throw new AppError('We could not load inventory value.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listAnalyticsRentalItems(client: Client) {
  const { data, error } = await client
    .from('rental_items')
    .select(`
      quantity,
      rental_requests ( status ),
      products ( uuid, name, sku )
    `)

  if (error) {
    throw new AppError('We could not load product rentals.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function countCustomerProfiles(client: Client) {
  const { count, error } = await client
    .from('profiles')
    .select('uuid', { count: 'exact', head: true })
    .eq('role', 'customer')

  if (error) {
    throw new AppError('We could not count customers.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return count ?? 0
}
