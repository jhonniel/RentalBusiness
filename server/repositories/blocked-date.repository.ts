import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const BLOCKED_DATE_SELECT = `
  uuid,
  starts_on,
  ends_on,
  reason,
  created_at
`

const BLOCKED_DATE_WITH_PRODUCT_SELECT = `
  ${BLOCKED_DATE_SELECT},
  products (
    uuid,
    name,
    status
  )
`

export async function listBlockedDatesByProductId(client: Client, productId: number) {
  const { data, error } = await client
    .from('product_blocked_dates')
    .select(BLOCKED_DATE_SELECT)
    .eq('product_id', productId)
    .order('starts_on', { ascending: false })
    .order('ends_on', { ascending: false })

  if (error) {
    throw new AppError('We could not load blocked dates.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listBlockedDatesOverlapping(
  client: Client,
  startsOn: string,
  endsOn: string,
) {
  const { data, error } = await client
    .from('product_blocked_dates')
    .select(BLOCKED_DATE_WITH_PRODUCT_SELECT)
    .lte('starts_on', endsOn)
    .gte('ends_on', startsOn)
    .order('starts_on', { ascending: true })
    .order('ends_on', { ascending: true })

  if (error) {
    throw new AppError('We could not load blocked dates.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function findBlockedDateByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('product_blocked_dates')
    .select(`id, product_id, ${BLOCKED_DATE_SELECT}`)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that blocked date.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertBlockedDate(
  client: Client,
  values: Database['public']['Tables']['product_blocked_dates']['Insert'],
) {
  const { data, error } = await client
    .from('product_blocked_dates')
    .insert(values)
    .select(BLOCKED_DATE_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not block those dates.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function deleteBlockedDateByUuid(client: Client, uuid: string) {
  const { error } = await client
    .from('product_blocked_dates')
    .delete()
    .eq('uuid', uuid)

  if (error) {
    throw new AppError('We could not remove that blocked date.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
}
