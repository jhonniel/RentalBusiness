import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AdminCalendar, AdminCalendarEvent } from '../../types/calendar'
import type { AdminRentalGroup, CalendarRentalStatus, RentalStatus } from '../../utils/constants'
import { BUSINESS_CURRENCY, BUSINESS_TIMEZONE } from '../../utils/constants'
import { monthBounds, monthKey } from '../../utils/calendar'
import { calendarDateInZone } from '../../utils/datetime'
import type { AssignAdminCommissionerInput, CancelAdminRentalInput, ContinueAdminRentalInput, CreateAdminRentalInput, EditAdminRentalExtensionInput, ExtendAdminRentalInput } from '../../utils/rental-validation'
import type { PublicRentalExtension, PublicRentalHistoryEntry, RentalExtensionPreview, RentalPaymentChange } from '../../types/rental'
import type { MarkAdminPaidInput } from '../../utils/payment-validation'
import { amountDue, amountToPay, canCancelAdminRental, canCompleteAdminRental, canMarkAdminRentalPaid, collectedPaymentFields, isRentalCode, paymentAmountAfterDepositReturn, paymentBalanceMoved, paymentChangeNote, paymentCollectedDeposit, toPublicRentalHistoryEntry, toShopRental } from '../../utils/rental'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { canModifyAdminRental } from '../../utils/waiver-invite'
import { rentalPeriodDays, rentalScheduleChange, resolveRentalWindow } from '../../utils/rental-window'
import { addMoney, quoteExtensionLine } from '../../utils/pricing'
import { adminRentalGroupOf } from '../../utils/analytics'
import { rentalActualSale, extensionPaymentStatus } from '../../utils/rental-extension'
import { mainPaidPayment, paymentHeldDeposit, rentalPaymentBalance } from '../../utils/rental-balance'
import { paymentKind } from '../../utils/payment'
import { commissionAmount } from '../../utils/commission'
import { findProductByUuid } from '../repositories/product.repository'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { rentalConfirmedEmail } from '../../utils/email-templates'
import { accountEmail } from '../utils/account-email'
import { recordAudit } from '../utils/audit'
import { logger } from '../utils/logger'
import { isPlaceholderBookingEmail } from '../utils/placeholder-booking-email'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { sendTemplatedEmail } from './email.service'
import { findProfileById, updateOwnProfile } from '../repositories/profile.repository'
import {
  deleteRentalById,
  deleteRentalByUuid,
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  listRentalStatusHistory,
  insertRentalItem,
  insertRentalRequest,
  insertRentalStatusHistory,
  listRentals,
  findCalendarRentalsByCode,
  listRentalsOverlapping,
  updateRentalSchedule,
  updateRentalItemByRentalId,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { findRentalExtension, insertRentalExtension, listExtensionAmountsByRentalIds, listExtensionStartsByRentalIds, listRentalExtensions, markRentalExtensionCancelled, updateRentalExtension } from '../repositories/rental-extension.repository'
import { ensureBookingCustomer } from './booking-customer'
import { buildQuote } from './rental.service'
import { applyLinkedCommissioner, reconcileCommissionExpense, syncAssignedCommission } from './commissioner.service'
import { rentalLateFee, stopLateFeeClock } from './late-fee.service'
import { listLatestFeedbackByRentalIds, type FeedbackRequestRow } from '../repositories/feedback.repository'
import { canSendFeedback, feedbackRequestStatus } from '../../utils/feedback'
import type { RentalFeedbackSummary } from '../../types/feedback'
import { findIdentityByRentalId } from '../repositories/identity.repository'
import { insertNotification } from '../repositories/notification.repository'
import {
  cancelOpenPaymentsByRentalId,
  findOpenPaymentByRentalId,
  findPaidPaymentByRentalId,
  listExtensionPaymentsByRentalId,
  listPaymentsByRentalId,
  insertPayment,
  updatePaymentByUuid,
} from '../repositories/payment.repository'
import { expireUnconfirmedRentals } from './cron.service'
import { findOpenCommissionExpenseByRentalId, voidCommissionExpenses } from '../repositories/expense.repository'
import { listAdminBlockedDatesOverlapping } from './blocked-date.service'
import { attachAdminIdentityUrls } from './identity.service'
import { issueReceiptForPayment } from './receipt.service'

type Client = SupabaseClient<Database>

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

async function notifyCustomerBookingConfirmed(
  client: Client,
  rental: Awaited<ReturnType<typeof loadAdminRental>>,
  options: { needsPayment: boolean },
) {
  const identity = await findRentalIdentity(client, rental.uuid)
  const profile = identity ? await findProfileById(client, identity.customer_id) : null
  if (!profile?.user_id) {
    return
  }

  const email = await accountEmail(profile.user_id)
  if (!email || isPlaceholderBookingEmail(email)) {
    return
  }

  const item = rental.items[0]
  if (!item) {
    return
  }

  const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    || [rental.customer?.firstName, rental.customer?.lastName].filter(Boolean).join(' ')
    || 'Customer'
  const message = rentalConfirmedEmail({
    customerName,
    rentalCode: rental.code,
    equipmentName: item.product.name,
    quantity: item.quantity,
    billingUnit: rental.billingUnit === 'hour' ? 'hour' : 'day',
    days: rentalPeriodDays(rental.startsOn, rental.endsOn),
    hours: rental.billingUnit === 'hour' ? (rental.billedHours ?? item.billedHours ?? null) : null,
    pickupAt: rental.pickupAt,
    returnAt: rental.returnAt,
    rentalUrl: `${siteOrigin()}/rentals/${rental.code}`,
    siteUrl: siteOrigin(),
    needsPayment: options.needsPayment,
  })

  await sendTemplatedEmail(client, {
    to: email,
    template: EMAIL_TEMPLATES.RENTAL_CONFIRMED,
    entityKey: rental.uuid,
    subject: message.subject,
    html: message.html,
  })
}

async function loadAdminRentalRow(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null

  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return { row, rental: toShopRental(row) }
}

async function enrichAdminRental(
  client: Client,
  rental: ReturnType<typeof toShopRental>,
  row: { id: number, customer_id: number },
) {
  const [identityUrls, email] = await Promise.all([
    attachAdminIdentityUrls(client, rental.uuid, rental.identity, row.id),
    rental.customer
      ? findProfileById(client, row.customer_id).then(profile => accountEmail(profile?.user_id))
      : Promise.resolve(null),
  ])
  rental.identity = identityUrls
  if (rental.customer) {
    rental.customer = { ...rental.customer, email }
  }
  return rental
}

async function loadAdminRental(client: Client, identifier: string) {
  const { row, rental } = await loadAdminRentalRow(client, identifier)
  return enrichAdminRental(client, rental, row)
}

function feedbackSummary(row: FeedbackRequestRow | undefined): RentalFeedbackSummary {
  return row
    ? { status: feedbackRequestStatus(row), averageRating: row.average_rating === null ? null : Number(row.average_rating) }
    : { status: 'not_sent', averageRating: null }
}

export async function listAdminRentals(client: Client, query: {
  status?: RentalStatus
  group?: AdminRentalGroup
  search?: string
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listRentals(client, {
    status: query.status,
    group: query.group,
    search: sanitizeSearch(query.search),
    from,
    to: from + query.pageSize - 1,
  })

  const now = new Date()
  const doneIds = rows.filter(row => canSendFeedback(row.status as RentalStatus)).map(row => row.id)
  const [extensions, feedback] = await Promise.all([
    listExtensionAmountsByRentalIds(client, rows.map(row => row.id)).catch(() => []),
    listLatestFeedbackByRentalIds(client, doneIds).catch(() => new Map<number, FeedbackRequestRow>()),
  ])
  return {
    items: rows.map((row) => {
      const rental = toShopRental(row)
      const payments = Array.isArray(row.payment_transactions) ? row.payment_transactions : row.payment_transactions ? [row.payment_transactions] : []
      const rentalExtensions = extensions.filter(extension => extension.rental_id === row.id)
      const paymentBalance = rentalPaymentBalance({
        status: rental.status,
        totalAmount: rental.totalAmount,
        depositAmount: rental.depositAmount,
        payments,
        extensions: rentalExtensions,
      })
      return {
        ...rental,
        paymentBalance,
        group: adminRentalGroupOf({
          status: rental.status,
          starts_on: row.starts_on,
          ends_on: row.ends_on,
          pickup_at: row.pickup_at,
          return_at: row.return_at,
        }, now),
        feedback: canSendFeedback(rental.status)
          ? feedbackSummary(feedback.get(row.id))
          : null,
        actualSale: rentalActualSale({
          totalAmount: rental.totalAmount,
          commissionAmount: rental.commissioner ? rental.commissionAmount ?? 0 : 0,
          payments,
          extensions: rentalExtensions,
          pendingBalance: paymentBalance?.balanceDue ?? 0,
        }),
      }
    }),
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
  const [rows, blockedDates] = await Promise.all([
    listRentalsOverlapping(client, {
      startsOn,
      endsOn,
      status: query.status,
    }),
    listAdminBlockedDatesOverlapping(client, startsOn, endsOn),
  ])
  const originalEnds = await calendarOriginalEnds(client, rows.map(row => row.id))

  return {
    month,
    startsOn,
    endsOn,
    timezone: BUSINESS_TIMEZONE,
    items: rows.map(row => toCalendarEvent(row, originalEnds.get(row.id) ?? null)),
    blockedDates,
  }
}

export async function findAdminCalendarRentals(client: Client, code: string): Promise<{ items: AdminCalendarEvent[] }> {
  const rows = await findCalendarRentalsByCode(client, code)
  const originalEnds = await calendarOriginalEnds(client, rows.map(row => row.id))
  return { items: rows.map(row => toCalendarEvent(row, originalEnds.get(row.id) ?? null)) }
}

async function calendarOriginalEnds(client: Client, rentalIds: number[]) {
  const rows = await listExtensionStartsByRentalIds(client, rentalIds).catch(() => [])
  const ends = new Map<number, string>()
  for (const row of rows) {
    if (row.cancelled_at || ends.has(row.rental_id)) {
      continue
    }
    ends.set(row.rental_id, row.previous_return_at ? calendarDateInZone(row.previous_return_at) : row.previous_ends_on)
  }
  return ends
}

function toCalendarEvent(row: Awaited<ReturnType<typeof listRentalsOverlapping>>[number], originalEndsOn: string | null): AdminCalendarEvent {
  const items = Array.isArray(row.rental_items) ? row.rental_items : []
  const product = firstName(items[0]?.products)

  return {
    originalEndsOn,
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
}

export async function getAdminRental(client: Client, identifier: string) {
  const loaded = await loadAdminRentalRow(client, identifier)
  const rentalId = loaded.row.id
  const [rental, rows, commissionExpense, paymentContext, lateFee] = await Promise.all([
    enrichAdminRental(client, loaded.rental, loaded.row),
    loadExtensionsSafely(client, rentalId),
    loaded.rental.commissioner ? findOpenCommissionExpenseByRentalId(client, rentalId) : Promise.resolve(null),
    extensionPaymentContext(client, rentalId).catch(() => null),
    rentalLateFee(client, loaded.rental, rentalId),
  ])
  const payments = rows.length ? paymentContext : null
  const confirmed = confirmedEndFrom(rental, rows, payments)
  const extensionLines = rows
    .filter(row => !row.cancelled_at)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .map(row => ({
      uuid: row.uuid,
      previousEndsOn: row.previous_ends_on,
      endsOn: row.ends_on,
      previousReturnAt: row.previous_return_at,
      returnAt: row.return_at,
      days: rentalPeriodDays(row.previous_ends_on, row.ends_on),
      addedAmount: Number(row.added_amount),
      paymentStatus: payments ? payments.statusOf(row) : 'included' as const,
    }))
  const commissionStatus = !commissionExpense
    ? 'not_recorded' as const
    : commissionExpense.status === 'paid' ? 'collected' as const : 'unclaimed' as const
  const rowPayments = loaded.row.payment_transactions
  const paymentBalance = rentalPaymentBalance({
    status: rental.status,
    totalAmount: rental.totalAmount,
    depositAmount: rental.depositAmount,
    payments: Array.isArray(rowPayments) ? rowPayments : rowPayments ? [rowPayments] : [],
    extensions: rows,
  })
  return { ...rental, pendingExtensionAmount: confirmed.pendingAmount, extensionLines, commissionStatus, lateFee, paymentBalance }
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
    hours: input.hours,
  }, {
    confirmedOnly: true,
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
    billing_unit: quote.billingUnit,
    billed_hours: quote.billingUnit === 'hour' ? quote.hours : null,
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
      billing_unit: quote.billingUnit,
      billed_hours: quote.billingUnit === 'hour' ? quote.hours : null,
      hourly_price: quote.billingUnit === 'hour' ? quote.hourlyPrice : null,
    })

    const { persistRentalAddonLines } = await import('./addon.service')
    await persistRentalAddonLines(client, created.id, quote.addons ?? [])

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

  await applyLinkedCommissioner(client, {
    id: created.id,
    uuid: created.uuid,
    code: created.code,
    status: 'draft',
  }, customerId, {
    productUuid: quote.product.uuid,
    productName: quote.product.name,
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    quantity: quote.quantity,
  }).catch(() => null)

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

/** The payments and extensions a paid booking's balance is worked out from. */
async function paymentBalanceRows(client: Client, rentalId: number) {
  const [payments, extensions] = await Promise.all([
    listPaymentsByRentalId(client, rentalId),
    loadExtensionsSafely(client, rentalId),
  ])
  return { payments, extensions }
}

/** Rent still to collect or give back on a paid booking, for the totals given. Null when it is not paid. */
async function currentPaymentBalance(
  client: Client,
  rentalId: number,
  rental: { status: string, totalAmount: number, depositAmount: number },
) {
  return rentalPaymentBalance({ ...rental, ...await paymentBalanceRows(client, rentalId) })
}

/**
 * Keeps a booking's payments in step with new totals.
 * An unpaid payment follows the new amount due.
 * A paid booking keeps its payment and paid date as they are: the rent difference stays open as a
 * balance or a refund until the admin marks it settled, and Sales move on that day.
 * Only the held deposit, which is never a sale, moves on the paid payment straight away.
 */
async function syncRentalPayments(
  client: Client,
  rentalId: number,
  rental: { status: string, totalAmount: number, depositAmount: number },
): Promise<RentalPaymentChange | null> {
  const openPayment = await findOpenPaymentByRentalId(client, rentalId)
  if (openPayment) {
    await updatePaymentByUuid(client, openPayment.uuid, {
      amount: amountDue(rental),
    })
  }

  const rows = await paymentBalanceRows(client, rentalId)
  const main = mainPaidPayment(rows.payments)
  if (!main) {
    return null
  }

  const held = paymentHeldDeposit(main.metadata)
  if (held !== null && addMoney(held) !== addMoney(rental.depositAmount)) {
    const metadata = main.metadata && typeof main.metadata === 'object' && !Array.isArray(main.metadata)
      ? main.metadata as Record<string, unknown>
      : {}
    const updated = await updatePaymentByUuid(client, main.uuid, {
      amount: Math.max(0, addMoney(Number(main.amount), rental.depositAmount, -held)),
      metadata: {
        ...metadata,
        depositAmount: Math.max(0, rental.depositAmount),
        depositAdjustedAt: new Date().toISOString(),
        depositAdjustedFrom: held,
      } as Database['public']['Tables']['payment_transactions']['Update']['metadata'],
    })
    rows.payments = rows.payments.map(payment => payment.uuid === updated.uuid ? updated : payment)
  }

  return rentalPaymentBalance({ ...rental, ...rows })
}

/**
 * For the continue form: where a paid booking would stand with these dates.
 * Null when the booking is not paid yet or can no longer be changed.
 */
export async function previewAdminRentalPaymentChange(
  client: Client,
  rentalUuid: string,
  quote: { totalAmount: number, depositAmount: number },
): Promise<RentalPaymentChange | null> {
  const row = await findRentalByUuid(client, rentalUuid)
  if (!row) {
    return null
  }

  const rental = toShopRental(row)
  if (!canModifyAdminRental(rental)) {
    return null
  }

  const discount = Math.min(rental.discountAmount, quote.totalAmount)
  return currentPaymentBalance(client, row.id, {
    status: rental.status,
    totalAmount: Math.max(0, quote.totalAmount - discount),
    depositAmount: quote.depositAmount,
  })
}

async function loadExtensionsSafely(client: Client, rentalId: number) {
  try {
    return await listRentalExtensions(client, rentalId)
  }
  catch {
    return []
  }
}

async function confirmedRentalEnd(client: Client, rental: { endsOn: string }, rentalId: number) {
  const rows = await loadExtensionsSafely(client, rentalId)
  if (!rows.length) {
    return { endsOn: rental.endsOn, pendingAmount: 0 }
  }

  return confirmedEndFrom(rental, rows, await extensionPaymentContext(client, rentalId))
}

function confirmedEndFrom(
  rental: { endsOn: string },
  rows: Awaited<ReturnType<typeof loadExtensionsSafely>>,
  payments: Awaited<ReturnType<typeof extensionPaymentContext>> | null,
) {
  if (!rows.length || !payments) {
    return { endsOn: rental.endsOn, pendingAmount: 0 }
  }

  const unpaid = rows
    .filter(row => !row.cancelled_at && payments.statusOf(row) === 'unpaid')
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
  return {
    endsOn: unpaid[0]?.previous_ends_on ?? rental.endsOn,
    pendingAmount: Math.round(unpaid.reduce((sum, row) => sum + Number(row.added_amount) * 100, 0)) / 100,
  }
}

async function recordEarnedCommission(
  client: Client,
  rental: { code: string, startsOn: string, endsOn: string, commissioner?: { firstName: string, lastName: string } | null, commissionAmount?: number, commissionPerDay?: number, items: { quantity: number, product: { name: string } }[] },
  rentalId: number,
  status: RentalStatus,
) {
  if (!rental.commissioner) {
    return null
  }

  const item = rental.items[0]
  const confirmed = await confirmedRentalEnd(client, rental, rentalId)
  return reconcileCommissionExpense(client, {
    id: rentalId,
    code: rental.code,
    status,
    commissioner: rental.commissioner,
    commissionAmount: rental.commissionAmount ?? 0,
    productName: item?.product.name || 'Equipment',
    days: rentalPeriodDays(rental.startsOn, confirmed.endsOn),
    quantity: item?.quantity ?? 1,
    partPaid: (rental.commissionAmount ?? 0) < commissionAmount(rental.commissionPerDay ?? 0, rental.startsOn, confirmed.endsOn, item?.quantity ?? 1),
  })
}

async function syncConfirmedCommission(
  client: Client,
  rental: { uuid: string, code: string, status: string, startsOn: string, endsOn: string, items: { quantity: number, product: { uuid: string, name: string } }[] },
  rentalId: number,
  commissionerUuid: string | undefined,
) {
  const item = rental.items[0]
  if (!item) {
    return null
  }

  const confirmed = await confirmedRentalEnd(client, rental, rentalId)
  // Read the totals again: the caller may have just saved new dates or a new quantity.
  const saved = await findRentalByUuid(client, rental.uuid)
  const totalAmount = Number(saved?.total_amount ?? 0)
  const balance = saved
    ? await currentPaymentBalance(client, rentalId, {
        status: rental.status,
        totalAmount,
        depositAmount: Number(saved.deposit_amount),
      })
    : null
  return syncAssignedCommission(client, {
    id: rentalId,
    uuid: rental.uuid,
    code: rental.code,
    status: rental.status,
  }, {
    commissionerUuid,
    productUuid: item.product.uuid,
    productName: item.product.name,
    startsOn: rental.startsOn,
    endsOn: confirmed.endsOn,
    days: rentalPeriodDays(rental.startsOn, confirmed.endsOn),
    quantity: item.quantity,
    paidRent: {
      rent: Math.max(0, addMoney(totalAmount, -confirmed.pendingAmount)),
      balanceDue: balance?.balanceDue ?? 0,
    },
  })
}

async function extensionPaymentContext(client: Client, rentalId: number) {
  const [mainPayment, extensionPayments] = await Promise.all([
    findPaidPaymentByRentalId(client, rentalId),
    listExtensionPaymentsByRentalId(client, rentalId),
  ])
  const paidExtensionUuids = new Set(extensionPayments.flatMap((payment) => {
    const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
      ? payment.metadata as Record<string, unknown>
      : {}
    return typeof metadata.extensionUuid === 'string' ? [metadata.extensionUuid] : []
  }))
  const paidAtByExtension = new Map(extensionPayments.flatMap((payment) => {
    const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
      ? payment.metadata as Record<string, unknown>
      : {}
    return typeof metadata.extensionUuid === 'string' ? [[metadata.extensionUuid, payment.paid_at] as const] : []
  }))
  return {
    mainPaidAt: mainPayment?.paid_at ?? null,
    paidExtensionUuids,
    paidAtByExtension,
    statusOf(row: { uuid: string, created_at: string }) {
      return extensionPaymentStatus({
        extensionCreatedAt: row.created_at,
        extensionUuid: row.uuid,
        mainPaidAt: mainPayment?.paid_at ?? null,
        paidExtensionUuids,
      })
    },
  }
}

async function quoteAdminExtension(
  client: Client,
  rental: Awaited<ReturnType<typeof loadAdminRental>>,
  endsOn: string,
  baseOverride?: { endsOn: string, totalAmount: number, subtotal: number, lineTotal: number },
) {
  if (!canModifyAdminRental(rental)) {
    throw new AppError('That booking can no longer be extended.', 409, ERROR_CODES.CONFLICT)
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const base = baseOverride ?? {
    endsOn: rental.endsOn,
    totalAmount: rental.totalAmount,
    subtotal: rental.subtotal,
    lineTotal: item.lineTotal,
  }

  if (endsOn <= base.endsOn) {
    throw new AppError('Choose a return date after the return date before this extension.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const quote = await buildQuote(client, {
    productUuid: item.product.uuid,
    startsOn: rental.startsOn,
    endsOn,
    pickupTime: rental.pickupTime,
    quantity: item.quantity,
    hours: 'billedHours' in rental ? rental.billedHours ?? undefined : undefined,
  }, {
    exceptRentalUuid: rental.uuid,
    allowPastStart: true,
    confirmedOnly: true,
  })

  const product = await findProductByUuid(client, item.product.uuid)
  if (!product) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const extension = quoteExtensionLine({
    dailyPrice: Number(product.daily_price),
    weeklyPrice: product.weekly_price === null ? null : Number(product.weekly_price),
    monthlyPrice: product.monthly_price === null ? null : Number(product.monthly_price),
    longStayLess: Number(product.long_stay_less ?? 0),
    longStayMinDays: Number(product.long_stay_min_days ?? 3),
    quantity: item.quantity,
    extensionDays: rentalPeriodDays(base.endsOn, endsOn),
  })

  return {
    item,
    quote,
    extension,
    base,
    subtotal: addMoney(base.subtotal, extension.lineTotal),
    lineTotal: addMoney(base.lineTotal, extension.lineTotal),
    totalAmount: addMoney(base.totalAmount, extension.lineTotal),
    addedAmount: extension.lineTotal,
  }
}

export async function extendAdminRental(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: ExtendAdminRentalInput,
): Promise<RentalExtensionPreview | ReturnType<typeof toShopRental>> {
  const rental = await loadAdminRental(client, identifier)
  const { item, quote, extension, subtotal, lineTotal, totalAmount, addedAmount } = await quoteAdminExtension(client, rental, input.endsOn)
  const preview: RentalExtensionPreview = {
    previousEndsOn: rental.endsOn,
    endsOn: quote.endsOn,
    previousReturnAt: rental.returnAt,
    returnAt: quote.returnAt,
    days: quote.days,
    extensionDays: extension.days,
    extensionRentAmount: extension.rentAmount,
    extensionLessAmount: extension.lessAmount,
    previousTotalAmount: rental.totalAmount,
    totalAmount,
    addedAmount,
    canFulfill: quote.canFulfill,
  }

  if (input.preview) {
    return preview
  }

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'Another booking already holds that kit on the new dates.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await insertRentalExtension(client, {
    rental_id: identity.id,
    previous_ends_on: rental.endsOn,
    ends_on: quote.endsOn,
    previous_return_at: rental.returnAt,
    return_at: quote.returnAt,
    previous_total_amount: rental.totalAmount,
    total_amount: totalAmount,
    added_amount: addedAmount,
    note: input.note || null,
    extended_by: profileId,
  })

  const schedule = {
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    pickupAt: quote.pickupAt,
    returnAt: quote.returnAt,
    notes: rental.notes,
    subtotal,
    depositAmount: rental.depositAmount,
    totalAmount,
  }
  await updateRentalSchedule(client, rental.uuid, schedule)
  await updateRentalItemByRentalId(client, identity.id, {
    quantity: item.quantity,
    dailyPrice: item.dailyPrice,
    lineTotal,
  })
  const updated = await updateRentalSchedule(client, rental.uuid, schedule)

  const commission = rental.commissioner
    ? await syncConfirmedCommission(client, { ...rental, endsOn: quote.endsOn }, identity.id, rental.commissioner.uuid)
    : null

  const paymentAdjustment = await syncRentalPayments(client, identity.id, {
    status: rental.status,
    totalAmount: Number(updated.total_amount),
    depositAmount: Number(updated.deposit_amount),
  })

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: `Admin extended the return date from ${rental.endsOn} to ${quote.endsOn}. Added ${addedAmount.toFixed(2)} ${BUSINESS_CURRENCY}.`,
  })

  await recordAudit(event, client, {
    action: 'rental.extend',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: {
      endsOn: rental.endsOn,
      returnAt: rental.returnAt,
      totalAmount: rental.totalAmount,
    },
    next: {
      endsOn: quote.endsOn,
      returnAt: quote.returnAt,
      totalAmount,
      addedAmount,
      commissionAmount: commission?.commissionAmount ?? null,
      paymentAdjustment,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

export async function listAdminRentalHistory(client: Client, identifier: string): Promise<PublicRentalHistoryEntry[]> {
  const { row } = await loadAdminRentalRow(client, identifier)
  const rows = await listRentalStatusHistory(client, row.id)
  return rows.map(toPublicRentalHistoryEntry)
}

export async function listAdminRentalExtensions(client: Client, identifier: string): Promise<PublicRentalExtension[]> {
  const { row: rentalRow, rental } = await loadAdminRentalRow(client, identifier)
  const [rows, payments] = await Promise.all([
    listRentalExtensions(client, rentalRow.id),
    extensionPaymentContext(client, rentalRow.id),
  ])
  const latestActive = rows.find(row => !row.cancelled_at)
  return rows.map((row) => {
    const person = Array.isArray(row.extended_by_profile) ? row.extended_by_profile[0] : row.extended_by_profile
    const name = person ? `${person.first_name} ${person.last_name}`.trim() : ''
    const paymentStatus = payments.statusOf(row)
    const changeable = canCancelRentalExtension(rental, row, latestActive?.uuid) && paymentStatus !== 'paid'
    return {
      paymentStatus,
      paidAt: payments.paidAtByExtension.get(row.uuid) ?? null,
      canMarkPaid: !row.cancelled_at && paymentStatus === 'unpaid' && Number(row.added_amount) > 0,
      uuid: row.uuid,
      previousEndsOn: row.previous_ends_on,
      endsOn: row.ends_on,
      previousReturnAt: row.previous_return_at,
      returnAt: row.return_at,
      previousTotalAmount: Number(row.previous_total_amount),
      totalAmount: Number(row.total_amount),
      addedAmount: Number(row.added_amount),
      note: row.note,
      extendedBy: name || null,
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at ?? null,
      cancelReason: row.cancel_reason ?? null,
      editedAt: row.edited_at ?? null,
      canCancel: changeable,
      canEdit: !row.cancelled_at,
      canEditDates: changeable,
    }
  })
}

export async function markAdminRentalExtensionPaid(
  event: H3Event,
  client: Client,
  identifier: string,
  extensionUuid: string,
  input: MarkAdminPaidInput,
) {
  const rental = await loadAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  const extension = await findRentalExtension(client, extensionUuid)
  if (!identity || !extension || extension.rental_id !== identity.id) {
    throw new AppError('Extension not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (extension.cancelled_at) {
    throw new AppError('A cancelled extension cannot be paid.', 409, ERROR_CODES.CONFLICT)
  }

  const payments = await extensionPaymentContext(client, identity.id)
  const status = payments.statusOf(extension)
  if (status === 'paid') {
    throw new AppError('This extension is already paid.', 409, ERROR_CODES.CONFLICT)
  }
  if (status === 'included') {
    throw new AppError('This extension is part of the booking payment. Record that payment instead.', 409, ERROR_CODES.CONFLICT)
  }

  const amount = Number(extension.added_amount)
  if (amount <= 0) {
    throw new AppError('This extension has nothing to pay.', 409, ERROR_CODES.CONFLICT)
  }

  const paidAt = new Date().toISOString()
  const payment = await insertPayment(client, {
    rental_id: identity.id,
    customer_id: identity.customer_id,
    amount,
    currency: BUSINESS_CURRENCY,
    provider: 'shop',
    provider_transaction_id: `shop-extension-${extension.uuid}`,
    status: 'paid',
    payment_method: input.paymentMethod,
    paid_at: paidAt,
    metadata: {
      kind: 'extension',
      extensionUuid: extension.uuid,
      recordedBy: 'admin',
      rentAmount: amount,
      includesDeposit: false,
    },
  })

  const commission = rental.commissioner
    ? await syncConfirmedCommission(client, rental, identity.id, rental.commissioner.uuid)
    : null

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: null,
    note: `Admin recorded a ${input.paymentMethod} payment of ${amount.toFixed(2)} ${BUSINESS_CURRENCY} for the extension to ${extension.ends_on}.${commission ? ` Commission is now ${commission.commissionAmount.toFixed(2)} ${BUSINESS_CURRENCY}.` : ''}`,
  })

  try {
    await issueReceiptForPayment(event, payment)
  }
  catch {
    // Receipt email can fail without rolling back the sale.
  }

  await recordAudit(event, client, {
    action: 'rental.extension.paid',
    entity: 'payment_transactions',
    entityId: payment.uuid,
    next: {
      rentalCode: rental.code,
      extensionUuid: extension.uuid,
      amount,
      paymentMethod: input.paymentMethod,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

/** Loads a paid booking with its open balance or refund, for the two actions that settle it. */
async function loadOpenBalance(client: Client, identifier: string) {
  const rental = await loadAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rows = await paymentBalanceRows(client, identity.id)
  const balance = rentalPaymentBalance({
    status: rental.status,
    totalAmount: rental.totalAmount,
    depositAmount: rental.depositAmount,
    ...rows,
  })
  const settledCount = rows.payments.filter(payment => ['balance', 'refund'].includes(paymentKind(payment.metadata))).length
  return { rental, identity, balance, sequence: settledCount + 1 }
}

/** Records the extra rent a paid booking owed after it changed. Sales count it today. */
export async function markAdminRentalBalancePaid(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: MarkAdminPaidInput,
) {
  const { rental, identity, balance, sequence } = await loadOpenBalance(client, identifier)
  const amount = balance?.balanceDue ?? 0
  if (amount <= 0) {
    throw new AppError('This booking has no unpaid balance.', 409, ERROR_CODES.CONFLICT)
  }

  let payment: Awaited<ReturnType<typeof insertPayment>>
  try {
    payment = await insertPayment(client, {
      rental_id: identity.id,
      customer_id: identity.customer_id,
      amount,
      currency: BUSINESS_CURRENCY,
      provider: 'shop',
      provider_transaction_id: `shop-balance-${rental.uuid}-${sequence}`,
      status: 'paid',
      payment_method: input.paymentMethod,
      paid_at: new Date().toISOString(),
      metadata: {
        kind: 'balance',
        recordedBy: 'admin',
        rentAmount: amount,
        includesDeposit: false,
      },
    })
  }
  catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      throw new AppError('This balance was just recorded. Refresh the page.', 409, ERROR_CODES.CONFLICT)
    }
    throw error
  }

  // The commission share that waited for this balance is earned now, and comes off Sales today with it.
  const commission = rental.commissioner
    ? await syncConfirmedCommission(client, rental, identity.id, rental.commissioner.uuid)
    : null
  const commissionAdded = commission ? Math.max(0, addMoney(commission.commissionAmount, -(rental.commissionAmount ?? 0))) : 0
  if (commissionAdded > 0) {
    payment = await updatePaymentByUuid(client, payment.uuid, {
      metadata: {
        kind: 'balance',
        recordedBy: 'admin',
        rentAmount: amount,
        includesDeposit: false,
        commissionAmount: commissionAdded,
      },
    })
  }

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: `Admin recorded a ${input.paymentMethod} payment of ${amount.toFixed(2)} ${BUSINESS_CURRENCY} for the unpaid balance.${commission ? ` Commission is now ${commission.commissionAmount.toFixed(2)} ${BUSINESS_CURRENCY}.` : ''}`,
  })

  try {
    await issueReceiptForPayment(event, payment)
  }
  catch {
    // Receipt email can fail without rolling back the sale.
  }

  await recordAudit(event, client, {
    action: 'rental.balance.paid',
    entity: 'payment_transactions',
    entityId: payment.uuid,
    next: { rentalCode: rental.code, amount, paymentMethod: input.paymentMethod, commissionAmount: commission?.commissionAmount ?? null },
  })

  return getAdminRental(client, rental.uuid)
}

/** Records the rent given back after a paid booking got cheaper. Sales drop by it today. */
export async function markAdminRentalRefundGiven(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: MarkAdminPaidInput,
) {
  const { rental, identity, balance, sequence } = await loadOpenBalance(client, identifier)
  const amount = balance?.refundDue ?? 0
  if (amount <= 0) {
    throw new AppError('This booking has nothing to refund.', 409, ERROR_CODES.CONFLICT)
  }

  const refundedAt = new Date().toISOString()
  let payment: Awaited<ReturnType<typeof insertPayment>>
  try {
    payment = await insertPayment(client, {
      rental_id: identity.id,
      customer_id: identity.customer_id,
      amount,
      currency: BUSINESS_CURRENCY,
      provider: 'shop',
      provider_transaction_id: `shop-refund-${rental.uuid}-${sequence}`,
      status: 'refunded',
      payment_method: input.paymentMethod,
      paid_at: refundedAt,
      metadata: {
        kind: 'refund',
        recordedBy: 'admin',
        refundedAt,
        includesDeposit: false,
      },
    })
  }
  catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      throw new AppError('This refund was just recorded. Refresh the page.', 409, ERROR_CODES.CONFLICT)
    }
    throw error
  }

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: `Admin refunded ${amount.toFixed(2)} ${BUSINESS_CURRENCY} to the customer by ${input.paymentMethod} after the booking changed.`,
  })

  await recordAudit(event, client, {
    action: 'rental.refund.given',
    entity: 'payment_transactions',
    entityId: payment.uuid,
    next: { rentalCode: rental.code, amount, paymentMethod: input.paymentMethod },
  })

  return getAdminRental(client, rental.uuid)
}

export async function editAdminRentalExtension(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  extensionUuid: string,
  input: EditAdminRentalExtensionInput,
): Promise<RentalExtensionPreview | ReturnType<typeof toShopRental>> {
  const rental = await loadAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  const extension = await findRentalExtension(client, extensionUuid)
  if (!identity || !extension || extension.rental_id !== identity.id) {
    throw new AppError('Extension not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (extension.cancelled_at) {
    throw new AppError('A cancelled extension cannot be edited.', 409, ERROR_CODES.CONFLICT)
  }

  const note = input.note === undefined ? extension.note : (input.note.trim() || null)
  const activeRows = await listRentalExtensions(client, identity.id)
  const extensionPaid = (await extensionPaymentContext(client, identity.id)).statusOf(extension) === 'paid'
  const isLatestEditable = !extensionPaid
    && canCancelRentalExtension(rental, extension, activeRows.find(row => !row.cancelled_at)?.uuid)
  const changesDates = Boolean(input.endsOn) && (input.endsOn !== extension.ends_on || isLatestEditable)

  if (!changesDates) {
    if (input.preview) {
      throw new AppError('Choose a different return date to preview.', 422, ERROR_CODES.VALIDATION_ERROR)
    }
    await updateRentalExtension(client, extension.uuid, { note, edited_at: new Date().toISOString(), edited_by: profileId })
    await recordAudit(event, client, {
      action: 'rental.extension.edit',
      entity: 'rental_extensions',
      entityId: extension.uuid,
      previous: { rentalCode: rental.code, note: extension.note },
      next: { rentalCode: rental.code, note },
    })
    return loadAdminRental(client, rental.uuid)
  }

  if (extensionPaid) {
    throw new AppError('This extension is already paid. Its return date cannot change.', 409, ERROR_CODES.CONFLICT)
  }

  const rows = await listRentalExtensions(client, identity.id)
  const latestActive = rows.find(row => !row.cancelled_at)
  if (!canCancelRentalExtension(rental, extension, latestActive?.uuid)) {
    throw new AppError(
      extension.uuid !== latestActive?.uuid
        ? 'Only the most recent extension can change its return date.'
        : 'The return date changed after this extension. Edit the booking instead.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const oldAdded = Number(extension.added_amount)
  const { quote, extension: line, base, subtotal, lineTotal, totalAmount, addedAmount } = await quoteAdminExtension(
    client,
    rental,
    input.endsOn!,
    {
      endsOn: extension.previous_ends_on,
      totalAmount: Math.max(0, addMoney(rental.totalAmount, -oldAdded)),
      subtotal: Math.max(0, addMoney(rental.subtotal, -oldAdded)),
      lineTotal: Math.max(0, addMoney(item.lineTotal, -oldAdded)),
    },
  )

  const preview: RentalExtensionPreview = {
    previousEndsOn: extension.previous_ends_on,
    endsOn: quote.endsOn,
    previousReturnAt: extension.previous_return_at || rental.returnAt,
    returnAt: quote.returnAt,
    days: quote.days,
    extensionDays: line.days,
    extensionRentAmount: line.rentAmount,
    extensionLessAmount: line.lessAmount,
    previousTotalAmount: base.totalAmount,
    totalAmount,
    addedAmount,
    canFulfill: quote.canFulfill,
  }

  if (input.preview) {
    return preview
  }

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'Another booking already holds that kit on the new dates.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  await updateRentalExtension(client, extension.uuid, {
    ends_on: quote.endsOn,
    return_at: quote.returnAt,
    total_amount: totalAmount,
    added_amount: addedAmount,
    note,
    edited_at: new Date().toISOString(),
    edited_by: profileId,
  })

  const schedule = {
    startsOn: rental.startsOn,
    endsOn: quote.endsOn,
    pickupAt: rental.pickupAt,
    returnAt: quote.returnAt,
    notes: rental.notes,
    subtotal,
    depositAmount: rental.depositAmount,
    totalAmount,
  }
  await updateRentalSchedule(client, rental.uuid, schedule)
  await updateRentalItemByRentalId(client, identity.id, {
    quantity: item.quantity,
    dailyPrice: item.dailyPrice,
    lineTotal,
  })
  const updated = await updateRentalSchedule(client, rental.uuid, schedule)

  if (rental.commissioner) {
    await syncConfirmedCommission(client, { ...rental, endsOn: quote.endsOn }, identity.id, rental.commissioner.uuid)
  }

  const paymentAdjustment = await syncRentalPayments(client, identity.id, {
    status: rental.status,
    totalAmount: Number(updated.total_amount),
    depositAmount: Number(updated.deposit_amount),
  })

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: `Admin edited the extension: return ${extension.ends_on} → ${quote.endsOn}. Extension ${oldAdded.toFixed(2)} → ${addedAmount.toFixed(2)} ${BUSINESS_CURRENCY}.`,
  })

  await recordAudit(event, client, {
    action: 'rental.extension.edit',
    entity: 'rental_extensions',
    entityId: extension.uuid,
    previous: {
      rentalCode: rental.code,
      endsOn: extension.ends_on,
      addedAmount: oldAdded,
      totalAmount: rental.totalAmount,
      note: extension.note,
    },
    next: {
      rentalCode: rental.code,
      endsOn: quote.endsOn,
      addedAmount,
      totalAmount,
      note,
      paymentAdjustment,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

function canCancelRentalExtension(
  rental: { status: RentalStatus, endsOn: string },
  extension: { uuid: string, ends_on: string, cancelled_at?: string | null },
  latestActiveUuid?: string,
) {
  return canModifyAdminRental(rental)
    && !extension.cancelled_at
    && extension.uuid === latestActiveUuid
    && rental.endsOn === extension.ends_on
}

export async function cancelAdminRentalExtension(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  extensionUuid: string,
  input: { reason?: string },
) {
  const rental = await loadAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  const extension = await findRentalExtension(client, extensionUuid)
  if (!identity || !extension || extension.rental_id !== identity.id) {
    throw new AppError('Extension not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (extension.cancelled_at) {
    throw new AppError('That extension is already cancelled.', 409, ERROR_CODES.CONFLICT)
  }

  if ((await extensionPaymentContext(client, identity.id)).statusOf(extension) === 'paid') {
    throw new AppError('This extension is already paid and cannot be cancelled.', 409, ERROR_CODES.CONFLICT)
  }

  const rows = await listRentalExtensions(client, identity.id)
  const latestActive = rows.find(row => !row.cancelled_at)
  if (!canCancelRentalExtension(rental, extension, latestActive?.uuid)) {
    throw new AppError(
      !canModifyAdminRental(rental)
        ? 'That booking can no longer be changed.'
        : extension.uuid !== latestActive?.uuid
          ? 'Cancel the most recent extension first.'
          : 'The return date changed after this extension. Edit the booking instead.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  const added = Number(extension.added_amount)
  const totalAmount = Math.max(0, addMoney(rental.totalAmount, -added))
  const schedule = {
    startsOn: rental.startsOn,
    endsOn: extension.previous_ends_on,
    pickupAt: rental.pickupAt,
    returnAt: extension.previous_return_at || resolveRentalWindow({
      startsOn: rental.startsOn,
      endsOn: extension.previous_ends_on,
      pickupTime: rental.pickupTime,
    }).returnAt,
    notes: rental.notes,
    subtotal: Math.max(0, addMoney(rental.subtotal, -added)),
    depositAmount: rental.depositAmount,
    totalAmount,
  }

  const reason = input.reason?.trim() || null
  await markRentalExtensionCancelled(client, extension.uuid, { cancelledBy: profileId, reason })
  await updateRentalSchedule(client, rental.uuid, schedule)
  await updateRentalItemByRentalId(client, identity.id, {
    quantity: item.quantity,
    dailyPrice: item.dailyPrice,
    lineTotal: Math.max(0, addMoney(item.lineTotal, -added)),
  })
  const updated = await updateRentalSchedule(client, rental.uuid, schedule)

  if (rental.commissioner) {
    await syncConfirmedCommission(client, { ...rental, endsOn: extension.previous_ends_on }, identity.id, rental.commissioner.uuid)
  }

  const paymentAdjustment = await syncRentalPayments(client, identity.id, {
    status: rental.status,
    totalAmount: Number(updated.total_amount),
    depositAmount: Number(updated.deposit_amount),
  })

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: profileId,
    note: [
      `Admin cancelled the extension and moved the return date back from ${extension.ends_on} to ${extension.previous_ends_on}. Removed ${added.toFixed(2)} ${BUSINESS_CURRENCY}.`,
      reason ? `Reason: ${reason}` : '',
    ].filter(Boolean).join(' '),
  })

  await recordAudit(event, client, {
    action: 'rental.extension.cancel',
    entity: 'rental_extensions',
    entityId: extension.uuid,
    previous: { rentalCode: rental.code, endsOn: extension.ends_on, totalAmount: rental.totalAmount },
    next: {
      rentalCode: rental.code,
      endsOn: extension.previous_ends_on,
      totalAmount,
      removedAmount: added,
      reason,
      paymentAdjustment,
    },
  })

  return loadAdminRental(client, rental.uuid)
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
    hours: input.hours ?? rental.billedHours ?? undefined,
    addons: input.addons ?? [],
  }, {
    exceptRentalUuid: rental.uuid,
    allowPastStart: true,
    confirmedOnly: true,
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
    billingUnit: quote.billingUnit,
    billedHours: quote.hours,
  })

  await updateRentalItemByRentalId(client, identity.id, {
    quantity: quote.quantity,
    dailyPrice: quote.dailyPrice,
    lineTotal: quote.lineTotal,
    billingUnit: quote.billingUnit,
    billedHours: quote.hours,
    hourlyPrice: quote.hourlyPrice,
  })

  const { replaceRentalAddonLines } = await import('./addon.service')
  await replaceRentalAddonLines(client, identity.id, quote.addons ?? [])

  // Addon replace triggers roll kit + add-on lines into rental totals; reload before payment sync.
  const refreshed = await findRentalByUuid(client, rental.uuid)
  const nextTotals = {
    totalAmount: Number(refreshed?.total_amount ?? updated.total_amount),
    depositAmount: Number(refreshed?.deposit_amount ?? updated.deposit_amount),
  }

  const commission = await syncConfirmedCommission(client, {
    uuid: rental.uuid,
    code: rental.code,
    status: rental.status,
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    items: [{ quantity: quote.quantity, product: item.product }],
  }, identity.id, input.commissionerUuid || undefined) ?? { commissionerUuid: null, commissionAmount: 0 }

  const book = Boolean(rental.waiver) && rental.status === 'draft'
  if (book) {
    if (!canTransitionRentalStatus(rental.status, 'pending')) {
      throw new AppError('That rental cannot be booked yet.', 409, ERROR_CODES.CONFLICT)
    }
    await updateRentalStatus(client, rental.uuid, 'pending')
  }

  const balanceBefore = await currentPaymentBalance(client, identity.id, rental)
  const balanceAfter = await syncRentalPayments(client, identity.id, { status: rental.status, ...nextTotals })
  const previousSchedule = { startsOn: rental.startsOn, endsOn: rental.endsOn, pickupTime: rental.pickupTime }
  const nextSchedule = { startsOn: quote.startsOn, endsOn: quote.endsOn, pickupTime: quote.pickupTime }
  const scheduleChange = rentalScheduleChange(previousSchedule, nextSchedule)
  const paymentChange: RentalPaymentChange | null = balanceAfter && paymentBalanceMoved(balanceBefore, balanceAfter)
    ? balanceAfter
    : null
  const previousAddons = (rental.addons ?? []).map(line => line.addon.name).sort().join(', ') || 'none'
  const nextAddons = (quote.addons ?? []).map(line => line.name).sort().join(', ') || 'none'
  const addonChange = previousAddons === nextAddons ? '' : `Add-ons changed: ${previousAddons} → ${nextAddons}.`
  const historyNote = [
    book
      ? 'Admin booked the rental after the waiver was signed.'
      : rental.status === 'draft'
        ? 'Admin continued the customer rental form.'
        : 'Admin updated the booking.',
    scheduleChange ? `Schedule changed: ${scheduleChange}.` : '',
    addonChange,
    paymentChange ? paymentChangeNote(paymentChange, BUSINESS_CURRENCY) : '',
    balanceAfter && addMoney(rental.depositAmount) !== addMoney(nextTotals.depositAmount)
      ? `Deposit held changed ${rental.depositAmount.toFixed(2)} → ${nextTotals.depositAmount.toFixed(2)} ${BUSINESS_CURRENCY}.`
      : '',
  ].filter(Boolean).join(' ')

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: book ? 'pending' : rental.status,
    changedBy: profileId,
    note: historyNote,
  })

  if (scheduleChange) {
    await recordAudit(event, client, {
      action: 'rental.schedule.admin',
      entity: 'rental_requests',
      entityId: rental.uuid,
      previous: { ...previousSchedule, pickupAt: rental.pickupAt, returnAt: rental.returnAt },
      next: { ...nextSchedule, pickupAt: quote.pickupAt, returnAt: quote.returnAt },
    })
  }

  await recordAudit(event, client, {
    action: 'rental.continue',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { ...previousSchedule, status: rental.status, totalAmount: rental.totalAmount },
    next: {
      startsOn: updated.starts_on,
      endsOn: updated.ends_on,
      pickupTime: quote.pickupTime,
      quantity: quote.quantity,
      status: book ? 'pending' : rental.status,
      commissionerUuid: commission.commissionerUuid,
      commissionAmount: commission.commissionAmount,
      totalAmount: nextTotals.totalAmount,
      paymentBalance: balanceAfter,
    },
  })

  return { ...await loadAdminRental(client, rental.uuid), paymentChange }
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

  const commission = await syncConfirmedCommission(client, rental, identity.id, input.commissionerUuid || undefined)
    ?? { commissionerUuid: null, commissionAmount: 0 }

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
  if (nextStatus === 'approved') {
    await recordEarnedCommission(client, rental, identity.id, 'approved')
  }

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: fullyCovered ? 'rental.approved' : 'rental.confirmed',
    title: fullyCovered ? 'Booking confirmed' : 'Booking confirmed',
    body: fullyCovered
      ? `Your rental ${rental.code} is confirmed and will be prepared for pickup.`
      : `The shop confirmed rental ${rental.code}. You can pay the down payment now.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  await notifyCustomerBookingConfirmed(client, rental, {
    needsPayment: nextStatus === 'awaiting_payment',
  }).catch((error) => {
    logger.warn('Booking confirmation email was not sent', {
      rentalUuid: rental.uuid,
      cause: error instanceof Error ? error.message : String(error),
    })
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
  await recordEarnedCommission(client, rental, identity.id, 'approved')

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
  rental: { uuid: string, code: string, status: string, billedHours?: number | null, items: { product: { uuid: string }, quantity: number }[], startsOn: string, endsOn: string, pickupTime: string },
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
    }, {
      exceptRentalUuid: rental.uuid,
      allowPastStart: true,
      confirmedOnly: true,
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
      amountToPay(rental) <= 0
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
  // After confirm, Payment Receive collects the down payment (rent) only. Deposit is not part of this payable.
  const due = amountToPay(rental)
  const requestedAmount = input.amount === undefined ? null : Number(input.amount)
  // Treat an amount below the full due as partial even if paymentType was omitted or left as full.
  const partial = input.paymentType === 'partial'
    || (requestedAmount !== null && Number.isFinite(requestedAmount) && addMoney(requestedAmount) < addMoney(due))
  const paidNow = partial ? Number(requestedAmount) : due
  if (!Number.isFinite(paidNow) || paidNow <= 0) {
    throw new AppError('Enter how much the customer paid.', 422, ERROR_CODES.VALIDATION_ERROR)
  }
  if (partial && addMoney(paidNow) >= addMoney(due)) {
    throw new AppError('For a partial payment, enter less than the full amount due.', 422, ERROR_CODES.VALIDATION_ERROR)
  }
  if (!partial && addMoney(paidNow) !== addMoney(due)) {
    throw new AppError('Full payment must match the amount due.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const paymentMetadata = {
    recordedBy: 'admin',
    includesDeposit: false,
    depositAmount: 0,
    rentAmount: paidNow,
    ...(partial ? { partial: true, amountDue: due } : {}),
  }

  const open = await findOpenPaymentByRentalId(client, identity.id)
  const payment = open
    ? await updatePaymentByUuid(client, open.uuid, {
        amount: paidNow,
        status: 'paid',
        provider: 'shop',
        provider_transaction_id: open.provider_transaction_id || `shop-${rental.uuid}`,
        payment_method: input.paymentMethod,
        paid_at: paidAt,
        metadata: {
          ...(open.metadata && typeof open.metadata === 'object' && !Array.isArray(open.metadata) ? open.metadata : {}),
          ...paymentMetadata,
        },
      })
    : await insertPayment(client, {
        rental_id: identity.id,
        customer_id: identity.customer_id,
        amount: paidNow,
        currency: BUSINESS_CURRENCY,
        provider: 'shop',
        provider_transaction_id: `shop-${rental.uuid}`,
        status: 'paid',
        payment_method: input.paymentMethod,
        paid_at: paidAt,
        metadata: paymentMetadata,
      })

  const remaining = Math.max(0, addMoney(due, -paidNow))
  await advanceAdminRentalStatus(
    event,
    client,
    profileId,
    { ...rental, status },
    'paid',
    partial
      ? `Admin recorded a partial ${input.paymentMethod} payment of ${paidNow.toFixed(2)} ${BUSINESS_CURRENCY}. Balance of ${remaining.toFixed(2)} ${BUSINESS_CURRENCY} stays unpaid.`
      : `Admin recorded a ${input.paymentMethod} payment.`,
  )

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'payment.received',
    title: 'Payment received',
    body: partial
      ? `The shop recorded a partial payment for rental ${rental.code}. A balance remains unpaid.`
      : `The shop recorded payment for rental ${rental.code}.`,
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
      paymentType: partial ? 'partial' : 'full',
      amount: payment.amount,
      amountDue: due,
      balanceDue: remaining,
    },
  })

  return loadAdminRental(client, rental.uuid)
}

export async function cancelAdminRental(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: CancelAdminRentalInput,
) {
  const rental = await loadAdminRental(client, identifier)
  if (!canCancelAdminRental(rental) || !canTransitionRentalStatus(rental.status, 'cancelled')) {
    throw new AppError(
      rental.status === 'active' || rental.status === 'overdue'
        ? 'The customer has the equipment. Mark it returned or done instead of cancelling.'
        : 'That booking can no longer be cancelled.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await cancelOpenPaymentsByRentalId(client, identity.id)

  const cancelledAt = new Date().toISOString()
  const paid = await findPaidPaymentByRentalId(client, identity.id)
  let retainedAmount = 0
  if (paid) {
    const metadata = paid.metadata && typeof paid.metadata === 'object' && !Array.isArray(paid.metadata)
      ? paid.metadata as Record<string, unknown>
      : {}
    retainedAmount = Number(paid.amount)
    await updatePaymentByUuid(client, paid.uuid, {
      metadata: {
        ...metadata,
        nonRefundable: true,
        retainedOnCancelAt: cancelledAt,
        retainedAmount,
      },
    })
  }

  await voidCommissionExpenses(client, identity.id)
  const row = await updateRentalStatus(client, rental.uuid, 'cancelled')
  const reason = input.reason?.trim() || ''
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: 'cancelled',
    changedBy: profileId,
    note: [
      'Admin cancelled the booking.',
      paid ? `The ${retainedAmount.toFixed(2)} ${BUSINESS_CURRENCY} already paid, including the deposit and down payment, is not refunded and stays in sales.` : '',
      reason ? `Reason: ${reason}` : '',
    ].filter(Boolean).join(' '),
  })

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'rental.cancelled',
    title: 'Booking cancelled',
    body: paid
      ? `Rental ${rental.code} was cancelled. The deposit and down payment are not refundable.`
      : `Rental ${rental.code} was cancelled.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  await recordAudit(event, client, {
    action: 'rental.cancel',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { status: rental.status },
    next: {
      status: 'cancelled',
      source: 'admin',
      retainedAmount,
      nonRefundable: Boolean(paid),
      reason: reason || null,
    },
  })

  return toShopRental(row)
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

  await stopLateFeeClock(client, rental, identity.id, profileId)

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

  const commissionExpenseUuid = await recordEarnedCommission(client, rental, identity.id, 'completed')

  await insertNotification(client, {
    recipient_id: identity.customer_id,
    type: 'rental.completed',
    title: 'Rental finished',
    body: rental.depositAmount > 0
      ? `Rental ${rental.code} is finished. The shop returns your deposit.`
      : `Rental ${rental.code} is finished.`,
    metadata: { rentalUuid: rental.uuid, rentalCode: rental.code },
  })

  const next = toShopRental(row)
  await recordAudit(event, client, {
    action: 'rental.complete',
    entity: 'rental_requests',
    entityId: next.uuid,
    previous: { status: rental.status, depositAmount: rental.depositAmount },
    next: { status: 'completed', commissionExpenseUuid },
  })

  // Thank-you email with a fresh feedback link. Soft-fail so finishing the rental still succeeds.
  await import('./feedback.service').then(({ sendFeedbackLink }) =>
    sendFeedbackLink(event, client, profileId, rental.uuid, { earnsReward: true }, { thankYou: true }),
  ).catch((error) => {
    logger.warn('Return thank-you email was not sent', {
      rentalUuid: rental.uuid,
      cause: error instanceof Error ? error.message : String(error),
    })
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
