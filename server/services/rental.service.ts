import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { CreateRentalInput, RentalQuoteQuery } from '../../utils/rental-validation'
import type { RentalQuote } from '../../types/rental'
import { evaluateAvailability } from '../../utils/availability'
import { inclusiveRentalDays, quoteRentalLine } from '../../utils/pricing'
import { isRentalCode, toPublicRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { getBookedQuantity } from '../repositories/availability.repository'
import { findProductBySlug, findProductByUuid } from '../repositories/product.repository'
import { updateOwnProfile } from '../repositories/profile.repository'
import {
  deleteRentalById,
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  insertRentalItem,
  insertRentalRequest,
  insertRentalStatusHistory,
  listRentals,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { cancelOpenPaymentsByRentalId, findPaidPaymentByRentalId } from '../repositories/payment.repository'
import { getSupabaseAdminClient } from '../utils/supabase'

type Client = SupabaseClient<Database>

async function loadActiveProduct(client: Client, query: { productUuid?: string, productSlug?: string }) {
  const identifier = query.productUuid || query.productSlug || ''
  const row = query.productUuid || isUuid(identifier)
    ? await findProductByUuid(client, query.productUuid || identifier)
    : await findProductBySlug(client, identifier)

  if (!row || row.status !== 'active' || !row.id) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return row
}

async function buildQuote(client: Client, query: RentalQuoteQuery): Promise<RentalQuote & { productId: number }> {
  const product = await loadActiveProduct(client, query)
  const booked = await getBookedQuantity(client, product.id, query.startsOn, query.endsOn)
  const availability = evaluateAvailability({
    quantity: product.quantity,
    damagedQuantity: product.damaged_quantity,
    maintenanceQuantity: product.maintenance_quantity,
    lostQuantity: product.lost_quantity,
    bookedQuantity: booked,
    requestedQuantity: query.quantity,
  })
  const days = inclusiveRentalDays(query.startsOn, query.endsOn)
  const line = quoteRentalLine({
    dailyPrice: Number(product.daily_price),
    weeklyPrice: product.weekly_price === null ? null : Number(product.weekly_price),
    monthlyPrice: product.monthly_price === null ? null : Number(product.monthly_price),
    depositAmount: Number(product.deposit_amount),
    quantity: query.quantity,
    days,
  })

  return {
    product: {
      uuid: product.uuid,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
    },
    startsOn: query.startsOn,
    endsOn: query.endsOn,
    days: line.days,
    quantity: line.quantity,
    dailyPrice: line.dailyPrice,
    lineTotal: line.lineTotal,
    depositAmount: line.depositAmount,
    subtotal: line.lineTotal,
    totalAmount: line.lineTotal,
    available: availability.available,
    canFulfill: availability.canFulfill,
    productId: product.id,
  }
}

export async function quoteRental(client: Client, query: RentalQuoteQuery) {
  const { productId: _productId, ...quote } = await buildQuote(client, query)
  return quote
}

export async function createRental(
  event: H3Event,
  client: Client,
  profile: { userId: string, profileId: number },
  input: CreateRentalInput,
) {
  const quote = await buildQuote(client, input)

  if (input.status === 'pending' && !quote.canFulfill) {
    throw new AppError(
      'That quantity is not available for the selected dates.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  await updateOwnProfile(client, profile.userId, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone || null,
  })

  const created = await insertRentalRequest(client, {
    customer_id: profile.profileId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    status: 'draft',
    subtotal: quote.subtotal,
    deposit_amount: quote.depositAmount,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: quote.totalAmount,
    notes: input.notes || null,
  })

  try {
    await insertRentalItem(client, {
      rental_id: created.id,
      product_id: quote.productId,
      quantity: quote.quantity,
      daily_price: quote.dailyPrice,
      line_total: quote.lineTotal,
    })

    if (input.status === 'pending') {
      await updateRentalStatus(client, created.uuid, 'pending')
    }

    await insertRentalStatusHistory(client, {
      rentalId: created.id,
      fromStatus: null,
      toStatus: input.status,
      changedBy: profile.profileId,
      note: input.status === 'pending' ? 'Customer submitted a rental request.' : 'Customer saved a draft.',
    })
  }
  catch (error) {
    await deleteRentalById(client, created.id)
    throw error
  }

  const row = await findRentalByUuid(client, created.uuid)
  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.create',
    entity: 'rental_requests',
    entityId: rental.uuid,
    next: { code: rental.code, status: rental.status },
  })

  return rental
}

export async function listOwnRentals(client: Client, query: { status?: import('../../utils/constants').RentalStatus, page: number, pageSize: number }) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listRentals(client, {
    status: query.status,
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(toPublicRental),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getOwnRental(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null

  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return toPublicRental(row)
}

export async function cancelOwnRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  const rental = await getOwnRental(client, identifier)
  if (!['draft', 'pending', 'awaiting_payment'].includes(rental.status) || !canTransitionRentalStatus(rental.status, 'cancelled')) {
    throw new AppError('That rental can no longer be cancelled.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const admin = getSupabaseAdminClient()
  if (await findPaidPaymentByRentalId(admin, identity.id)) {
    throw new AppError('A paid rental cannot be cancelled here.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.status === 'awaiting_payment') {
    await cancelOpenPaymentsByRentalId(admin, identity.id)
  }

  const row = await updateRentalStatus(client, rental.uuid, 'cancelled')
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: 'cancelled',
    changedBy: profileId,
    note: 'Customer cancelled the request.',
  })

  const next = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.cancel',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status },
    next: { status: 'cancelled' },
  })

  return next
}
