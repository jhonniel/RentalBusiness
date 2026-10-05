import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { INVENTORY_OCCUPYING_RENTAL_STATUSES } from '../../utils/constants'
import { addCalendarDays } from '../../utils/expense'
import { businessDateTimeToUtc } from '../../utils/rental-window'
import { AppError, ERROR_CODES } from '../utils/errors'
import { getSupabaseAdminClient } from '../utils/supabase'

type Client = SupabaseClient<Database>

const HOLD_STATUSES = ['draft', ...INVENTORY_OCCUPYING_RENTAL_STATUSES] as const

function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  const aStart = Date.parse(startA)
  const aEnd = Date.parse(endA)
  const bStart = Date.parse(startB)
  const bEnd = Date.parse(endB)
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) {
    return false
  }

  return aStart < bEnd && aEnd > bStart
}

export async function listOccupyingRanges(
  _client: Client,
  productId: number,
  startsOn: string,
  endsOn: string,
) {
  const rangeStart = businessDateTimeToUtc(startsOn, '00:00')
  const rangeEnd = businessDateTimeToUtc(addCalendarDays(endsOn, 1), '00:00')
  const { data, error } = await getSupabaseAdminClient()
    .from('rental_requests')
    .select('starts_on, ends_on, pickup_at, return_at, rental_items!inner(quantity, product_id)')
    .in('status', [...HOLD_STATUSES])
    .lt('pickup_at', rangeEnd)
    .gt('return_at', rangeStart)
    .eq('rental_items.product_id', productId)

  if (error) {
    throw new AppError('We could not check availability.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []).flatMap((row) => {
    const items = Array.isArray(row.rental_items) ? row.rental_items : [row.rental_items]
    return items
      .filter(item => item.product_id === productId)
      .map(item => ({
        starts_on: row.starts_on,
        ends_on: row.ends_on,
        pickup_at: row.pickup_at,
        return_at: row.return_at,
        quantity: item.quantity,
      }))
  })
}

export async function getBookedQuantity(
  client: Client,
  productId: number,
  startsOn: string,
  endsOn: string,
  window?: { pickupAt: string, returnAt: string },
) {
  const ranges = await listOccupyingRanges(client, productId, startsOn, endsOn)
  const pickupAt = window?.pickupAt || businessDateTimeToUtc(startsOn, '00:00')
  const returnAt = window?.returnAt || businessDateTimeToUtc(addCalendarDays(endsOn, 1), '00:00')

  return ranges.reduce((sum, range) => {
    if (!range.pickup_at || !range.return_at) {
      return sum
    }
    if (!windowsOverlap(range.pickup_at, range.return_at, pickupAt, returnAt)) {
      return sum
    }
    return sum + range.quantity
  }, 0)
}

export async function listBlockedRanges(
  client: Client,
  productId: number,
  startsOn: string,
  endsOn: string,
) {
  const { data, error } = await client.rpc('product_blocked_ranges', {
    p_product_id: productId,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
  })

  if (error) {
    throw new AppError('We could not check availability.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}
