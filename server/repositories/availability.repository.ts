import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function getBookedQuantity(
  client: Client,
  productId: number,
  startsOn: string,
  endsOn: string,
) {
  const { data, error } = await client.rpc('product_booked_quantity', {
    p_product_id: productId,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
  })

  if (error) {
    throw new AppError('We could not check availability.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? 0
}

export async function listOccupyingRanges(
  client: Client,
  productId: number,
  startsOn: string,
  endsOn: string,
) {
  const { data, error } = await client.rpc('product_occupying_ranges', {
    p_product_id: productId,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
  })

  if (error) {
    throw new AppError('We could not check availability.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}
