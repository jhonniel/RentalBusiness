import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityCalendar, AvailabilityResponse } from '../../types/availability'
import type { Database } from '../../types/database.types'
import { evaluateAvailability, unavailableDates } from '../../utils/availability'
import { addCalendarDays } from '../../utils/expense'
import { calendarDateInZone, inclusiveDayCount } from '../../utils/datetime'
import { isBookableProductStatus } from '../../utils/constants'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { getBookedQuantity, listOccupyingRanges } from '../repositories/availability.repository'
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
  quantity: number
}): Promise<AvailabilityResponse> {
  const row = await loadActiveProduct(client, query.productUuid, query.productSlug)

  const booked = await getBookedQuantity(client, row.id, query.startsOn, query.endsOn)
  const result = evaluateAvailability({
    quantity: row.quantity,
    damagedQuantity: row.damaged_quantity,
    maintenanceQuantity: row.maintenance_quantity,
    lostQuantity: row.lost_quantity,
    bookedQuantity: booked,
    requestedQuantity: query.quantity,
  })

  return {
    product: {
      uuid: row.uuid,
      slug: row.slug,
      name: row.name,
      sku: row.sku,
    },
    startsOn: query.startsOn,
    endsOn: query.endsOn,
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
  const dates = unavailableDates({
    stock: {
      quantity: row.quantity,
      damagedQuantity: row.damaged_quantity,
      maintenanceQuantity: row.maintenance_quantity,
      lostQuantity: row.lost_quantity,
    },
    bookings: ranges.map(range => ({
      productUuid: row.uuid,
      quantity: range.quantity,
      startsOn: range.starts_on,
      endsOn: range.ends_on,
      status: 'approved',
    })),
    productUuid: row.uuid,
    requestedQuantity: query.quantity,
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
  }
}
