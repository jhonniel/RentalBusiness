import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminRentalQuoteQuery, CreateRentalInput, RentalQuoteQuery, RescheduleOwnRentalInput } from '../../utils/rental-validation'
import type { PublicRental, RentalQuote, RentalReschedulePreview } from '../../types/rental'
import { RENTAL_REQUEST_NOTIFY_EMAIL, isBookableProductStatus } from '../../utils/constants'
import { evaluateAvailability } from '../../utils/availability'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { rentalSubmittedStaffEmail } from '../../utils/email-templates'
import { isPastBusinessDate } from '../../utils/datetime'
import { quoteRentalLine } from '../../utils/pricing'
import { resolveRentalWindow } from '../../utils/rental-window'
import { isRentalCode, toPublicRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { logger } from '../utils/logger'
import { expireUnconfirmedRentals } from './cron.service'
import { getBookedQuantity, listBlockedRanges } from '../repositories/availability.repository'
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
  updateRentalDraft,
  updateRentalItemByRentalId,
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

export async function buildQuote(client: Client, query: RentalQuoteQuery | AdminRentalQuoteQuery, options?: {
  exceptRentalUuid?: string
  allowPastStart?: boolean
  confirmedOnly?: boolean
}): Promise<RentalQuote & {
  productId: number
  hasBlockedDates: boolean
}> {
  const product = await loadActiveProduct(client, query)
  const window = resolveRentalWindow(query)
  if (!options?.allowPastStart && isPastBusinessDate(window.startsOn)) {
    throw new AppError('Those dates are in the past.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const booked = await getBookedQuantity(client, product.id, window.startsOn, window.endsOn, {
    pickupAt: window.pickupAt,
    returnAt: window.returnAt,
    exceptRentalUuid: options?.exceptRentalUuid,
    confirmedOnly: options?.confirmedOnly,
  })
  const blockedRanges = await listBlockedRanges(client, product.id, window.startsOn, window.endsOn)
  const hasBlockedDates = blockedRanges.length > 0
  const availability = evaluateAvailability({
    quantity: product.quantity,
    damagedQuantity: product.damaged_quantity,
    maintenanceQuantity: product.maintenance_quantity,
    lostQuantity: product.lost_quantity,
    bookedQuantity: booked,
    requestedQuantity: query.quantity,
    hasBlockedDates,
  })
  const days = window.days
  const line = quoteRentalLine({
    dailyPrice: Number(product.daily_price),
    weeklyPrice: product.weekly_price === null ? null : Number(product.weekly_price),
    monthlyPrice: product.monthly_price === null ? null : Number(product.monthly_price),
    depositAmount: Number(product.deposit_amount),
    longStayLess: Number(product.long_stay_less ?? 0),
    longStayMinDays: Number(product.long_stay_min_days ?? 3),
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
    startsOn: window.startsOn,
    endsOn: window.endsOn,
    pickupTime: window.pickupTime,
    pickupAt: window.pickupAt,
    returnAt: window.returnAt,
    days: line.days,
    quantity: line.quantity,
    dailyPrice: line.dailyPrice,
    rentAmount: line.rentAmount,
    lessAmount: line.lessAmount,
    lineTotal: line.lineTotal,
    depositAmount: line.depositAmount,
    subtotal: line.lineTotal,
    totalAmount: line.lineTotal,
    available: availability.available,
    canFulfill: availability.canFulfill,
    productId: product.id,
    hasBlockedDates,
  }
}

export async function quoteRental(
  client: Client,
  query: RentalQuoteQuery | AdminRentalQuoteQuery,
  options: { confirmedOnly?: boolean } = {},
) {
  const exceptRentalUuid = 'exceptRentalUuid' in query ? query.exceptRentalUuid : undefined
  const { productId: _productId, hasBlockedDates: _hasBlockedDates, ...quote } = await buildQuote(client, query, {
    exceptRentalUuid,
    allowPastStart: Boolean(exceptRentalUuid),
    confirmedOnly: options.confirmedOnly,
  })
  return quote
}

export async function createRental(
  event: H3Event,
  client: Client,
  profile: { userId: string, profileId: number },
  input: CreateRentalInput,
) {
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const quote = await buildQuote(client, input)

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'Those dates are not available. Another request already holds that kit.',
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
    starts_on: quote.startsOn,
    ends_on: quote.endsOn,
    pickup_at: quote.pickupAt,
    return_at: quote.returnAt,
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
    await deleteRentalById(getSupabaseAdminClient(), created.id)
    throw error
  }

  try {
    const { applyLinkedCommissioner } = await import('./commissioner.service')
    await applyLinkedCommissioner(getSupabaseAdminClient(), {
      id: created.id,
      uuid: created.uuid,
      code: created.code,
      status: 'draft',
    }, profile.profileId, {
      productUuid: quote.product.uuid,
      productName: quote.product.name,
      startsOn: quote.startsOn,
      endsOn: quote.endsOn,
      quantity: quote.quantity,
    })
  }
  catch (error) {
    logger.warn('Linked commissioner was not applied to a new booking', {
      rentalCode: created.code,
      error: error instanceof Error ? error.message : String(error),
    })
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

  await expireUnconfirmedRentals(event).catch(() => undefined)
  const quote = await buildQuote(client, {
    productUuid: item.product.uuid,
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    pickupTime: rental.pickupTime,
    quantity: item.quantity,
  }, {
    exceptRentalUuid: rental.uuid,
  })

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'That quantity is not available for the selected dates.',
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

export async function rescheduleOwnRental(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: RescheduleOwnRentalInput,
): Promise<RentalReschedulePreview | PublicRental> {
  const rental = await getOwnRental(client, identifier)
  if (rental.status !== 'draft') {
    throw new AppError('Only a draft booking can be rescheduled. Contact the shop to change a submitted booking.', 409, ERROR_CODES.CONFLICT)
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const admin = getSupabaseAdminClient()
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const quote = await buildQuote(admin, {
    productUuid: item.product.uuid,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    pickupTime: input.pickupTime,
    quantity: item.quantity,
  }, {
    exceptRentalUuid: rental.uuid,
  })

  const discountAmount = Math.min(rental.discountAmount, quote.totalAmount)
  const totalAmount = Math.max(0, quote.totalAmount - discountAmount)
  const preview: RentalReschedulePreview = {
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    pickupTime: quote.pickupTime,
    pickupAt: quote.pickupAt,
    returnAt: quote.returnAt,
    days: quote.days,
    rentAmount: quote.rentAmount,
    lessAmount: quote.lessAmount,
    discountAmount,
    totalAmount,
    depositAmount: quote.depositAmount,
    amountDue: Math.round((totalAmount + quote.depositAmount) * 100) / 100,
    available: quote.available,
    canFulfill: quote.canFulfill,
  }

  if (input.preview) {
    return preview
  }

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'Those dates are not available. Another booking already holds that kit.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(admin, rental.uuid)
  if (!identity || identity.customer_id !== profileId) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const schedule = {
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    pickupAt: quote.pickupAt,
    returnAt: quote.returnAt,
    notes: rental.notes,
    subtotal: quote.subtotal,
    depositAmount: quote.depositAmount,
    totalAmount,
  }
  await updateRentalDraft(admin, rental.uuid, schedule)
  await updateRentalItemByRentalId(admin, identity.id, {
    quantity: quote.quantity,
    dailyPrice: quote.dailyPrice,
    lineTotal: quote.lineTotal,
  })
  await updateRentalDraft(admin, rental.uuid, schedule)

  if (identity.commissioner_id) {
    const commissioner = await findProfileById(admin, identity.commissioner_id)
    if (commissioner) {
      const { syncAssignedCommission } = await import('./commissioner.service')
      await syncAssignedCommission(admin, { id: identity.id, uuid: rental.uuid, code: rental.code }, {
        commissionerUuid: commissioner.uuid,
        productUuid: item.product.uuid,
        productName: item.product.name,
        startsOn: quote.startsOn,
        endsOn: quote.endsOn,
        days: quote.days,
        quantity: quote.quantity,
      })
    }
  }

  await insertRentalStatusHistory(admin, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: 'Customer rescheduled the draft booking.',
  })

  await recordAudit(event, client, {
    action: 'rental.schedule.customer',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { startsOn: rental.startsOn, endsOn: rental.endsOn, pickupTime: rental.pickupTime, totalAmount: rental.totalAmount },
    next: { startsOn: quote.startsOn, endsOn: quote.endsOn, pickupTime: quote.pickupTime, totalAmount },
  })

  return getOwnRental(client, rental.uuid)
}

export async function getOwnRentalCalendar(client: Client, identifier: string) {
  const rental = await getOwnRental(client, identifier)
  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const { getProductAvailabilityCalendar } = await import('./availability.service')
  return getProductAvailabilityCalendar(client, {
    productUuid: item.product.uuid,
    quantity: item.quantity,
    exceptRentalUuid: rental.uuid,
  })
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
