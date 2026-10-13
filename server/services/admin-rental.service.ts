import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminCalendar } from '../../types/calendar'
import type { CalendarRentalStatus, RentalStatus } from '../../utils/constants'
import { BUSINESS_CURRENCY, BUSINESS_TIMEZONE } from '../../utils/constants'
import { monthBounds, monthKey } from '../../utils/calendar'
import { calendarDateInZone } from '../../utils/datetime'
import type { ContinueAdminRentalInput, CreateAdminRentalInput, AssignAdminCommissionerInput } from '../../utils/rental-validation'
import type { MarkAdminPaidInput } from '../../utils/payment-validation'
import { amountDue, canCompleteAdminRental, canMarkAdminRentalPaid, collectedPaymentFields, isRentalCode, paymentAmountAfterDepositReturn, paymentCollectedDeposit, toShopRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { canModifyAdminRental } from '../../utils/waiver-invite'
import { rentalPeriodDays } from '../../utils/rental-window'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { accountEmail } from '../utils/account-email'
import { recordAudit } from '../utils/audit'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { findProfileById, updateOwnProfile } from '../repositories/profile.repository'
import {
  deleteRentalById,
  deleteRentalByUuid,
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  insertRentalItem,
  insertRentalRequest,
  insertRentalStatusHistory,
  listRentals,
  listRentalsOverlapping,
  updateRentalSchedule,
  updateRentalItemByRentalId,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { ensureBookingCustomer } from './booking-customer'
import { buildQuote } from './rental.service'
import { syncAssignedCommission } from './commissioner.service'
import { findIdentityByRentalId } from '../repositories/identity.repository'
import { insertNotification } from '../repositories/notification.repository'
import {
  findOpenPaymentByRentalId,
  findPaidPaymentByRentalId,
  insertPayment,
  updatePaymentByUuid,
} from '../repositories/payment.repository'
import { expireUnconfirmedRentals } from './cron.service'
import { voidCommissionExpenses } from '../repositories/expense.repository'
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

  const rental = toShopRental(row)
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
    items: rows.map(toShopRental),
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

export async function createAdminRental(
  event: H3Event,
  client: Client,
  profileId: number,
  input: CreateAdminRentalInput,
) {
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const customerId = await ensureBookingCustomer(client, input)
  const quote = await buildQuote(client, {
    productUuid: input.productUuid,
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

  const created = await insertRentalRequest(client, {
    customer_id: customerId,
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
      changedBy: profileId,
      note: 'Admin created a booking for the customer.',
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

  const rental = toShopRental(row)
  await recordAudit(event, client, {
    action: 'rental.create',
    entity: 'rental_requests',
    entityId: rental.uuid,
    next: { code: rental.code, status: rental.status, source: 'admin' },
  })

  return rental
}

export async function continueAdminRental(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: ContinueAdminRentalInput,
) {
  const rental = await loadAdminRental(client, identifier)
  if (!canModifyAdminRental(rental)) {
    throw new AppError('That booking can no longer be changed.', 409, ERROR_CODES.CONFLICT)
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
  }, {
    exceptRentalUuid: rental.uuid,
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
  const updated = await updateRentalSchedule(client, rental.uuid, {
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

  const commission = await syncAssignedCommission(client, {
    id: identity.id,
    uuid: rental.uuid,
    code: rental.code,
  }, {
    commissionerUuid: input.commissionerUuid || undefined,
    productUuid: item.product.uuid,
    productName: item.product.name,
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    days: quote.days,
    quantity: quote.quantity,
  })

  const book = Boolean(rental.waiver) && rental.status === 'draft'
  if (book) {
    if (!canTransitionRentalStatus(rental.status, 'pending')) {
      throw new AppError('That rental cannot be booked yet.', 409, ERROR_CODES.CONFLICT)
    }
    await updateRentalStatus(client, rental.uuid, 'pending')
  }

  const openPayment = await findOpenPaymentByRentalId(client, identity.id)
  if (openPayment) {
    await updatePaymentByUuid(client, openPayment.uuid, {
      amount: amountDue({
        totalAmount: Number(updated.total_amount),
        depositAmount: Number(updated.deposit_amount),
      }),
    })
  }

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: book ? 'pending' : rental.status,
    changedBy: profileId,
    note: book
      ? 'Admin booked the rental after the waiver was signed.'
      : rental.status === 'draft'
        ? 'Admin continued the customer rental form.'
        : 'Admin updated the booking.',
  })

  await recordAudit(event, client, {
    action: 'rental.continue',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { startsOn: rental.startsOn, endsOn: rental.endsOn, status: rental.status },
    next: {
      startsOn: updated.starts_on,
      endsOn: updated.ends_on,
      quantity: quote.quantity,
      status: book ? 'pending' : rental.status,
      commissionerUuid: commission.commissionerUuid,
      commissionAmount: commission.commissionAmount,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

export async function assignAdminRentalCommissioner(
  event: H3Event,
  client: Client,
  identifier: string,
  input: AssignAdminCommissionerInput,
) {
  const rental = await loadAdminRental(client, identifier)
  if (!canModifyAdminRental(rental)) {
    throw new AppError('That booking can no longer be assigned to a commissioner.', 409, ERROR_CODES.CONFLICT)
  }

  const item = rental.items[0]
  const identity = await findRentalIdentity(client, rental.uuid)
  if (!item || !identity) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const commission = await syncAssignedCommission(client, {
    id: identity.id,
    uuid: rental.uuid,
    code: rental.code,
  }, {
    commissionerUuid: input.commissionerUuid || undefined,
    productUuid: item.product.uuid,
    productName: item.product.name,
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    days: rentalPeriodDays(rental.startsOn, rental.endsOn),
    quantity: item.quantity,
  })

  await recordAudit(event, client, {
    action: 'rental.commissioner',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: {
      status: rental.status,
      commissionerUuid: rental.commissioner?.uuid ?? null,
      commissionAmount: rental.commissionAmount ?? 0,
    },
    next: {
      status: rental.status,
      commissionerUuid: commission.commissionerUuid,
      commissionAmount: commission.commissionAmount,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

export async function confirmAdminRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const rental = await loadAdminRental(client, identifier)
  if (rental.status !== 'pending') {
    throw new AppError('Confirm a submitted request first.', 409, ERROR_CODES.CONFLICT)
  }

  const fullyCovered = amountDue(rental) === 0 && Boolean(rental.voucher)
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

  const next = toShopRental(row)
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
  const fullyCovered = amountDue(rental) === 0 && Boolean(rental.voucher)
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

  const next = toShopRental(row)
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
      amountDue(rental) <= 0
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
  const due = amountDue(rental)
  const open = await findOpenPaymentByRentalId(client, identity.id)
  const payment = open
    ? await updatePaymentByUuid(client, open.uuid, {
        amount: due,
        status: 'paid',
        provider: 'shop',
        provider_transaction_id: open.provider_transaction_id || `shop-${rental.uuid}`,
        payment_method: input.paymentMethod,
        paid_at: paidAt,
        metadata: {
          ...(open.metadata && typeof open.metadata === 'object' && !Array.isArray(open.metadata) ? open.metadata : {}),
          recordedBy: 'admin',
          ...collectedPaymentFields(rental),
        },
      })
    : await insertPayment(client, {
        rental_id: identity.id,
        customer_id: identity.customer_id,
        amount: due,
        currency: BUSINESS_CURRENCY,
        provider: 'shop',
        provider_transaction_id: `shop-${rental.uuid}`,
        status: 'paid',
        payment_method: input.paymentMethod,
        paid_at: paidAt,
        metadata: { recordedBy: 'admin', ...collectedPaymentFields(rental) },
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

export async function completeAdminRental(event: H3Event, client: Client, profileId: number, identifier: string) {
  const rental = await loadAdminRental(client, identifier)
  if (!canCompleteAdminRental(rental)) {
    throw new AppError(
      rental.status === 'completed'
        ? 'This rental is already finished.'
        : 'Mark the rental done after the return time.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  if (!canTransitionRentalStatus(rental.status, 'completed')) {
    throw new AppError('That rental cannot be finished yet.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const payment = await findPaidPaymentByRentalId(client, identity.id)
  if (payment && rental.depositAmount > 0 && paymentCollectedDeposit(payment.metadata)) {
    const returnedAt = new Date().toISOString()
    const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
      ? payment.metadata
      : {}
    await updatePaymentByUuid(client, payment.uuid, {
      amount: paymentAmountAfterDepositReturn(Number(payment.amount), rental.depositAmount),
      metadata: {
        ...metadata,
        depositReturnedAt: returnedAt,
        depositReturnedAmount: rental.depositAmount,
      },
    })
  }

  const row = await updateRentalStatus(client, rental.uuid, 'completed')
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: 'completed',
    changedBy: profileId,
    note: rental.depositAmount > 0
      ? 'Admin finished the rental and released the deposit from sales.'
      : 'Admin finished the rental.',
  })

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'rental.completed',
    title: 'Rental finished',
    body: rental.depositAmount > 0
      ? `Rental ${rental.code} is finished. The deposit is no longer part of the sale.`
      : `Rental ${rental.code} is finished.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  const next = toShopRental(row)
  await recordAudit(event, client, {
    action: 'rental.complete',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status, depositAmount: rental.depositAmount },
    next: { status: 'completed' },
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

  await voidCommissionExpenses(client, identity.id)
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
