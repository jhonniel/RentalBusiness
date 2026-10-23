import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'
import { isMissingDeletedColumn } from './profile.repository'

type Client = SupabaseClient<Database>

const OPEN_RENTAL_STATUSES = ['draft', 'pending', 'awaiting_payment', 'paid', 'approved', 'ready_for_pickup', 'active', 'overdue', 'returned'] as const

export async function listCustomers(client: Client, filters: {
  search?: string
  from: number
  to: number
}) {
  const query = (activeOnly: boolean) => {
    let builder = client
      .from('profiles')
      .select('uuid, user_id, first_name, last_name, phone, created_at, rental_requests!rental_requests_customer_id_fkey(count)', { count: 'exact' })
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .range(filters.from, filters.to)

    if (activeOnly) {
      builder = builder.is('deleted_at', null)
    }
    if (filters.search) {
      builder = builder.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`)
    }
    return builder
  }

  let { data, error, count } = await query(true)
  if (isMissingDeletedColumn(error)) {
    ({ data, error, count } = await query(false))
  }

  if (error) {
    throw new AppError('We could not load customers.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function countOpenRentalsForProfile(client: Client, profileId: number) {
  const { count, error } = await client
    .from('rental_requests')
    .select('uuid', { count: 'exact', head: true })
    .or(`customer_id.eq.${profileId},commissioner_id.eq.${profileId}`)
    .in('status', [...OPEN_RENTAL_STATUSES])

  if (error) {
    throw new AppError('We could not check that account’s bookings.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return count ?? 0
}
