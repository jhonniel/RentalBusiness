import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminCalendar } from '../../types/calendar'
import type { CalendarRentalStatus, RentalStatus } from '../../utils/constants'
import { BUSINESS_CURRENCY, BUSINESS_TIMEZONE } from '../../utils/constants'
import { monthBounds, monthKey } from '../../utils/calendar'
import { calendarDateInZone } from '../../utils/datetime'
import type { ContinueAdminRentalInput } from '../../utils/rental-validation'
import type { MarkAdminPaidInput } from '../../utils/payment-validation'
import { canMarkAdminRentalPaid, isRentalCode, toPublicRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { canContinueAdminRental } from '../../utils/waiver-invite'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { accountEmail } from '../utils/account-email'
import { recordAudit } from '../utils/audit'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { findProfileById, updateOwnProfile } from '../repositories/profile.repository'
import {
  deleteRentalByUuid,
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  insertRentalStatusHistory,
  listRentals,
  listRentalsOverlapping,
  updateRentalDraft,
  updateRentalItemByRentalId,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { buildQuote } from './rental.service'
import { findIdentityByRentalId } from '../repositories/identity.repository'
import { insertNotification } from '../repositories/notification.repository'
import {
  findOpenPaymentByRentalId,
  findPaidPaymentByRentalId,
  insertPayment,
  updatePaymentByUuid,
} from '../repositories/payment.repository'
import { expireUnconfirmedRentals } from './cron.service'
import { listAdminBlockedDatesOverlapping } from './blocked-date.service'
import { attachAdminIdentityUrls } from './identity.service'
import { issueReceiptForPayment } from './receipt.service'

type Client = SupabaseClient<Database>

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

async function loadAdminRental(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null

  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = toPublicRental(row)
  rental.identity = await attachAdminIdentityUrls(client, rental.uuid, rental.identity)
  const identity = await findRentalIdentity(client, rental.uuid)
  const profile = identity ? await findProfileById(client, identity.customer_id) : null
  if (rental.customer) {
    rental.customer = {
      ...rental.customer,
      email: await accountEmail(profile?.user_id),
    }
  }
  return rental
}

export async function listAdminRentals(client: Client, query: {
  status?: RentalStatus
  search?: string
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listRentals(client, {
    status: query.status,
    search: sanitizeSearch(query.search),
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

function firstName(value: unknown): string | null {
  if (!value) {
    return null
  }

  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') {
    return null
  }

  const record = row as { name?: string, first_name?: string, last_name?: string }
  if (record.name) {
    return record.name
  }

  const full = [record.first_name, record.last_name].filter(Boolean).join(' ').trim()
  return full || null
}

export async function getAdminCalendar(client: Client, query: {
  month?: string
  status?: CalendarRentalStatus
}): Promise<AdminCalendar> {
  const month = query.month || monthKey(calendarDateInZone())
  const { startsOn, endsOn } = monthBounds(month)
  const rows = await listRentalsOverlapping(client, {
    startsOn,
    endsOn,
    status: query.status,
  })
  const blockedDates = await listAdminBlockedDatesOverlapping(client, startsOn, endsOn)

  return {
    month,
    startsOn,
    endsOn,
    timezone: BUSINESS_TIMEZONE,
    items: rows.map((row) => {
      const items = Array.isArray(row.rental_items) ? row.rental_items : []
      const product = firstName(items[0]?.products)

      return {
        uuid: row.uuid,
        code: row.code,
        status: row.status as CalendarRentalStatus,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        pickupAt: row.pickup_at,
        returnAt: row.return_at,
        productName: product || row.code,
        customerName: firstName(row.profiles),
      }
    }),
    blockedDates,
  }
}

export async function getAdminRental(client: Client, identifier: string) {
  return loadAdminRental(client, identifier)
}

export async function continueAdminRental(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: ContinueAdminRentalInput,
) {
  const rental = await loadAdminRental(client, identifier)
  if (!canContinueAdminRental(rental)) {
    throw new AppError('Only a draft rental can be continued.', 409, ERROR_CODES.CONFLICT)
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  const customer = identity ? await findProfileById(client, identity.customer_id) : null
  if (!identity || !customer) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await expireUnconfirmedRentals(event).catch(() => undefined)
  const quote = await buildQuote(client, {
    productUuid: item.product.uuid,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    pickupTime: input.pickupTime,
    quantity: input.quantity,
  })

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'Those dates are not available. Another request already holds that kit.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  await updateOwnProfile(client, customer.user_id, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone || null,
  })

  const discount = Math.min(rental.discountAmount, quote.totalAmount)
  const updated = await updateRentalDraft(client, rental.uuid, {
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    pickupAt: quote.pickupAt,
    returnAt: quote.returnAt,
    notes: input.notes || null,
    subtotal: quote.subtotal,
    depositAmount: quote.depositAmount,
    totalAmount: Math.max(0, quote.totalAmount - discount),
  })

  await updateRentalItemByRentalId(client, identity.id, {
    quantity: quote.quantity,
    dailyPrice: quote.dailyPrice,
    lineTotal: quote.lineTotal,
  })

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: 'Admin continued the customer rental form.',
  })

  await recordAudit(event, client, {
    action: 'rental.continue',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { startsOn: rental.startsOn, endsOn: rental.endsOn },
    next: { startsOn: updated.starts_on, endsOn: updated.ends_on, quantity: quote.quantity },
  })

  return loadAdminRental(client, rental.uuid)
}

export async function confirmAdminRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const rental = await loadAdminRental(client, identifier)
  if (rental.status !== 'pending') {
    throw new AppError('Confirm a submitted request first.', 409, ERROR_CODES.CONFLICT)
  }

  const fullyCovered = rental.totalAmount === 0 && Boolean(rental.voucher)
  const nextStatus: RentalStatus = fullyCovered ? 'approved' : 'awaiting_payment'
  if (!canTransitionRentalStatus(rental.status, nextStatus)) {
    throw new AppError('That rental cannot be confirmed yet.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await updateRentalStatus(client, rental.uuid, nextStatus)
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: nextStatus,
    changedBy: profileId,
    note: fullyCovered
      ? 'Admin confirmed a fully covered booking.'
      : 'Admin confirmed the booking. Customer can pay.',
  })

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: fullyCovered ? 'rental.approved' : 'rental.confirmed',
    title: fullyCovered ? 'Booking confirmed' : 'Booking confirmed',
    body: fullyCovered
      ? `Your rental ${rental.code} is confirmed and will be prepared for pickup.`
      : `The shop confirmed rental ${rental.code}. You can pay the down payment now.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  const next = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.confirm',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status },
    next: { status: nextStatus },
  })

  return next
}

export async function approveAdminRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  const rental = await loadAdminRental(client, identifier)
  const fullyCovered = rental.totalAmount === 0 && Boolean(rental.voucher)
  if (!canTransitionRentalStatus(rental.status, 'approved') && !fullyCovered) {
    throw new AppError('That rental cannot be approved yet.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.status !== 'paid' && !fullyCovered) {
    throw new AppError('Approve only after payment is confirmed.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await updateRentalStatus(client, rental.uuid, 'approved')
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: 'approved',
    changedBy: profileId,
    note: 'Admin approved the rental.',
  })

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'rental.approved',
    title: 'Rental approved',
    body: `Your rental ${rental.code} is approved and will be prepared for pickup.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  const next = toPublicRental(row)
  await recordAudit(event, client, {
    action: 'rental.approve',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status },
    next: { status: 'approved' },
  })

  return next
}

async function advanceAdminRentalStatus(
  event: H3Event,
  client: Client,
  profileId: number,
  rental: { uuid: string, code: string, status: string, items: { product: { uuid: string }, quantity: number }[], startsOn: string, endsOn: string, pickupTime: string },
  nextStatus: RentalStatus,
  note: string,
) {
  if (rental.status === nextStatus) {
    return rental.status
  }

  if (!canTransitionRentalStatus(rental.status as RentalStatus, nextStatus)) {
    throw new AppError('That rental cannot be marked paid yet.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.status === 'draft' && nextStatus === 'pending') {
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
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await updateRentalStatus(client, rental.uuid, nextStatus)
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: nextStatus,
    changedBy: profileId,
    note,
  })

  return nextStatus
}

export async function markAdminRentalPaid(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: MarkAdminPaidInput,
) {
  const rental = await loadAdminRental(client, identifier)
  if (!canMarkAdminRentalPaid(rental)) {
    throw new AppError(
      rental.totalAmount <= 0
        ? 'That rental has no amount due.'
        : !rental.waiver
          ? 'The customer must sign the waiver before payment can be recorded.'
          : !rental.identity
            ? 'Upload identity documents before payment can be recorded.'
            : 'That rental cannot be marked paid yet.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const alreadyPaid = await findPaidPaymentByRentalId(client, identity.id)
  if (alreadyPaid) {
    throw new AppError('This rental is already paid.', 409, ERROR_CODES.CONFLICT)
  }

  let status = rental.status
  if (status === 'draft') {
    status = await advanceAdminRentalStatus(
      event,
      client,
      profileId,
      rental,
      'pending',
      'Admin submitted the rental to record a shop payment.',
    )
  }
  if (status === 'pending') {
    status = await advanceAdminRentalStatus(
      event,
      client,
      profileId,
      { ...rental, status },
      'awaiting_payment',
      'Admin confirmed the booking to record a shop payment.',
    )
  }

  const paidAt = new Date().toISOString()
  const open = await findOpenPaymentByRentalId(client, identity.id)
  const payment = open
    ? await updatePaymentByUuid(client, open.uuid, {
        status: 'paid',
        provider: 'shop',
        provider_transaction_id: open.provider_transaction_id || `shop-${rental.uuid}`,
        payment_method: input.paymentMethod,
        paid_at: paidAt,
      })
    : await insertPayment(client, {
        rental_id: identity.id,
        customer_id: identity.customer_id,
        amount: rental.totalAmount,
        currency: BUSINESS_CURRENCY,
        provider: 'shop',
        provider_transaction_id: `shop-${rental.uuid}`,
        status: 'paid',
        payment_method: input.paymentMethod,
        paid_at: paidAt,
        metadata: { recordedBy: 'admin' },
      })

  await advanceAdminRentalStatus(
    event,
    client,
    profileId,
    { ...rental, status },
    'paid',
    `Admin recorded a ${input.paymentMethod} payment.`,
  )

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'payment.received',
    title: 'Payment received',
    body: `The shop recorded payment for rental ${rental.code}.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  try {
    await issueReceiptForPayment(event, payment)
  }
  catch {
    // Receipt email can fail without rolling back the sale.
  }

  await recordAudit(event, client, {
    action: 'rental.paid',
    entity: 'payment_transactions',
    entityId: payment.uuid,
    previous: { status: rental.status },
    next: {
      status: 'paid',
      paymentMethod: input.paymentMethod,
      amount: payment.amount,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

export async function deleteAdminRental(event: H3Event, client: Client, identifier: string) {
  const rental = await loadAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const documents = await findIdentityByRentalId(client, identity.id)
  const paths = [documents?.government_id_path, documents?.selfie_path].filter((path): path is string => Boolean(path))
  if (paths.length) {
    await client.storage.from(STORAGE_BUCKETS.privateDocuments).remove(paths)
  }

  await deleteRentalByUuid(client, rental.uuid)

  await recordAudit(event, client, {
    action: 'rental.delete',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: {
      uuid: rental.uuid,
      code: rental.code,
      status: rental.status,
    },
  })

  return {
    deleted: true,
    uuid: rental.uuid,
    code: rental.code,
  }
}
