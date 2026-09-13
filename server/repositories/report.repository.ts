import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function listReportPayments(client: Client) {
  const { data, error } = await client
    .from('payment_transactions')
    .select('uuid, amount, currency, status, payment_method, paid_at, rental_requests ( uuid, code )')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  if (error) {
    throw new AppError('We could not load sales.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listReportExpenses(client: Client, startsOn: string, endsOn: string) {
  const { data, error } = await client
    .from('expenses')
    .select('uuid, name, category, vendor, reference, amount, status, incurred_on')
    .gte('incurred_on', startsOn)
    .lte('incurred_on', endsOn)
    .order('incurred_on', { ascending: false })

  if (error) {
    throw new AppError('We could not load expenses.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listReportRentals(client: Client, startsOn: string, endsOn: string) {
  const { data, error } = await client
    .from('rental_requests')
    .select('uuid, code, status, starts_on, ends_on, total_amount, profiles ( first_name, last_name )')
    .lte('starts_on', endsOn)
    .gte('ends_on', startsOn)
    .order('starts_on', { ascending: false })

  if (error) {
    throw new AppError('We could not load rentals.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listReportProducts(client: Client) {
  const { data, error } = await client
    .from('products')
    .select('uuid, name, sku, status, quantity, damaged_quantity, maintenance_quantity, lost_quantity, replacement_value')
    .neq('status', 'archived')
    .order('name')

  if (error) {
    throw new AppError('We could not load inventory.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listReportUtilizationItems(client: Client) {
  const { data, error } = await client
    .from('rental_items')
    .select(`
      quantity,
      rental_requests ( status, starts_on, ends_on ),
      products ( uuid, name, sku, status, quantity, damaged_quantity, maintenance_quantity, lost_quantity, replacement_value )
    `)

  if (error) {
    throw new AppError('We could not load utilization.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}
