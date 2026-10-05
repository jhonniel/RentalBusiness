import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityCalendar, AvailabilityResponse } from '../../types/availability'
import type { Database } from '../../types/database.types'
import {
  blockedDatesFromRanges,
  datesWithBookings,
  evaluateAvailability,
  mergeUnavailableDates,
  toCalendarDate,
  unavailableDates,
} from '../../utils/availability'
import { addCalendarDays } from '../../utils/expense'
import { calendarDateInZone, inclusiveDayCount, isPastBusinessDate } from '../../utils/datetime'
import { DEFAULT_PICKUP_TIME, resolveRentalWindow } from '../../utils/rental-window'
import { isBookableProductStatus } from '../../utils/constants'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { getBookedQuantity, listBlockedRanges, listOccupyingRanges } from '../repositories/availability.repository'
import { findProductBySlug, findProductByUuid } from '../repositories/product.repository'

type Client = SupabaseClient<Database>

async function loadActiveProduct(client: Client, productUuid?: string, productSlug?: string) {
  const identifier = productUuid || productSlug || ''
  const row = productUuid || isUuid(identifier)
    ? await findProductByUuid(client, productUuid || identifier)
    : await findProductBySlug(client, identifier)

  if (!row || !row.id) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (row.status === 'coming_soon') {
    throw new AppError('That kit is coming soon and cannot be booked yet.', 409, ERROR_CODES.CONFLICT)
  }

  if (!isBookableProductStatus(row.status)) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return row
}

export async function getProductAvailability(client: Client, query: {
  productUuid?: string
  productSlug?: string
  startsOn: string
  endsOn: string
  pickupTime?: string
  quantity: number
}): Promise<AvailabilityResponse> {
  const row = await loadActiveProduct(client, query.productUuid, query.productSlug)
  const window = resolveRentalWindow({
    startsOn: query.startsOn,
    endsOn: query.endsOn,
    pickupTime: query.pickupTime || DEFAULT_PICKUP_TIME,
  })
  if (isPastBusinessDate(window.startsOn)) {
    throw new AppError('Those dates are in the past.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const booked = await getBookedQuantity(client, row.id, window.startsOn, window.endsOn, {
    pickupAt: window.pickupAt,
    returnAt: window.returnAt,
  })
  const blockedRanges = await listBlockedRanges(client, row.id, window.startsOn, window.endsOn)
  const result = evaluateAvailability({
    quantity: row.quantity,
    damagedQuantity: row.damaged_quantity,
    maintenanceQuantity: row.maintenance_quantity,
    lostQuantity: row.lost_quantity,
    bookedQuantity: booked,
    requestedQuantity: query.quantity,
    hasBlockedDates: blockedRanges.length > 0,
  })

  return {
    product: {
      uuid: row.uuid,
      slug: row.slug,
      name: row.name,
      sku: row.sku,
    },
    startsOn: window.startsOn,
    endsOn: window.endsOn,
    pickupTime: window.pickupTime,
    pickupAt: window.pickupAt,
    returnAt: window.returnAt,
    ...result,
  }
}

export async function getProductAvailabilityCalendar(client: Client, query: {
  productUuid?: string
  productSlug?: string
  quantity: number
  from?: string
  to?: string
}): Promise<AvailabilityCalendar> {
  const row = await loadActiveProduct(client, query.productUuid, query.productSlug)
  const from = query.from || calendarDateInZone()
  const to = query.to || addCalendarDays(from, 180)

  if (inclusiveDayCount(from, to) > 366) {
    throw new AppError('Choose a date window of 366 days or less.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const ranges = await listOccupyingRanges(client, row.id, from, to)
  const blockedRanges = await listBlockedRanges(client, row.id, from, to)
  const occupyingWindows = ranges
    .filter(range => range.pickup_at && range.return_at)
    .map(range => ({
      pickupAt: range.pickup_at,
      returnAt: range.return_at,
      quantity: range.quantity,
    }))
  const bookings = ranges.map(range => ({
    productUuid: row.uuid,
    quantity: range.quantity,
    startsOn: toCalendarDate(range.starts_on),
    endsOn: toCalendarDate(range.ends_on),
    pickupAt: range.pickup_at || undefined,
    returnAt: range.return_at || undefined,
    status: 'approved' as const,
  }))
  const closedDates = unavailableDates({
    stock: {
      quantity: row.quantity,
      damagedQuantity: row.damaged_quantity,
      maintenanceQuantity: row.maintenance_quantity,
      lostQuantity: row.lost_quantity,
    },
    bookings,
    productUuid: row.uuid,
    requestedQuantity: query.quantity,
    from,
    to,
  })
  const dates = mergeUnavailableDates(
    closedDates,
    blockedDatesFromRanges(
      blockedRanges.map(range => ({
        startsOn: toCalendarDate(range.starts_on),
        endsOn: toCalendarDate(range.ends_on),
      })),
      from,
      to,
    ),
  )
  const bookingsOnDates = datesWithBookings({
    bookings,
    productUuid: row.uuid,
    from,
    to,
  })

  return {
    product: {
      uuid: row.uuid,
      slug: row.slug,
      name: row.name,
      sku: row.sku,
    },
    from,
    to,
    quantity: query.quantity,
    unavailableDates: dates,
    bookedDates: bookingsOnDates,
    occupyingWindows,
  }
}
