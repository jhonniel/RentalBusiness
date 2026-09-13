import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function listCustomers(client: Client, filters: {
  search?: string
  from: number
  to: number
}) {
  let query = client
    .from('profiles')
    .select('uuid, first_name, last_name, phone, created_at, rental_requests(count)', { count: 'exact' })
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .range(filters.from, filters.to)

  if (filters.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load customers.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}
