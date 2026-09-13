import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { CreateRentalInput, RentalQuoteQuery } from '../../utils/rental-validation'
import type { PublicRental, RentalQuote } from '../../types/rental'
import { RENTAL_REQUEST_NOTIFY_EMAIL } from '../../utils/constants'
import { evaluateAvailability } from '../../utils/availability'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { rentalSubmittedStaffEmail } from '../../utils/email-templates'
import { inclusiveRentalDays, quoteRentalLine } from '../../utils/pricing'
import { isRentalCode, toPublicRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { logger } from '../utils/logger'
import { getBookedQuantity } from '../repositories/availability.repository'
import { findProductBySlug, findProductByUuid } from '../repositories/product.repository'
import { findProfileById, updateOwnProfile } from '../repositories/profile.repository'
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
import { sendTemplatedEmail } from './email.service'

type Client = SupabaseClient<Database>

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

async function customerEmail(admin: Client, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) {
    return null
  }
  return data.user.email
}

async function notifyStaffOfSubmittedRental(rental: PublicRental) {
  const admin = getSupabaseAdminClient()
  const identity = await findRentalIdentity(admin, rental.uuid)
  const profile = identity ? await findProfileById(admin, identity.customer_id) : null
  const email = profile ? await customerEmail(admin, profile.user_id) : null
  const customerName = [rental.customer?.firstName, rental.customer?.lastName].filter(Boolean).join(' ')
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || 'Customer'

  const message = rentalSubmittedStaffEmail({
    rentalCode: rental.code,
    customerName,
    customerEmail: email || 'Not on file',
    customerPhone: rental.customer?.phone || profile?.phone || '',
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    items: rental.items.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    totalAmount: rental.totalAmount,
    depositAmount: rental.depositAmount,
    notes: rental.notes,
    adminUrl: `${siteOrigin()}/admin/rentals/${rental.code}`,
  })

  await sendTemplatedEmail(admin, {
    to: RENTAL_REQUEST_NOTIFY_EMAIL,
    template: EMAIL_TEMPLATES.RENTAL_SUBMITTED,
    entityKey: rental.uuid,
    subject: message.subject,
    html: message.html,
  })
}

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

  if (!quote.canFulfill) {
    throw new AppError(
      'Those dates are not available. Another request already holds that kit.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  if (input.status === 'pending') {
    throw new AppError(
      'Sign the waiver and upload identity documents before submitting this request.',
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

    await insertRentalStatusHistory(client, {
      rentalId: created.id,
      fromStatus: null,
      toStatus: 'draft',
      changedBy: profile.profileId,
      note: 'Customer started a rental request.',
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

export async function submitOwnRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  const rental = await getOwnRental(client, identifier)

  if (rental.status !== 'draft' || !canTransitionRentalStatus(rental.status, 'pending')) {
    throw new AppError('That rental cannot be submitted.', 409, ERROR_CODES.CONFLICT)
  }

  if (!rental.waiver) {
    throw new AppError('Sign the rental waiver before submitting this request.', 409, ERROR_CODES.CONFLICT)
  }

  if (!rental.identity) {
    throw new AppError('Upload a government ID and selfie before submitting this request.', 409, ERROR_CODES.CONFLICT)
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const quote = await buildQuote(client, {
    productUuid: item.product.uuid,
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    quantity: item.quantity,
  })

  if (!quote.canFulfill) {
    throw new AppError(
      'That quantity is not available for the selected dates.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await updateRentalStatus(client, rental.uuid, 'pending')
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: 'pending',
    changedBy: profileId,
    note: 'Customer submitted a rental request.',
  })

  const next = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.submit',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status },
    next: { code: next.code, status: next.status },
  })

  try {
    await notifyStaffOfSubmittedRental(next)
  }
  catch (error) {
    logger.warn('Staff rental-request email was not sent', {
      rentalCode: next.code,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
  }

  return next
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
