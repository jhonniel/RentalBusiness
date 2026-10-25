import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PublicProfile } from '../../types/auth'
import { commissionAmount, commissionStillToRecord, canReleaseCommissionerBooking, isCommissionEarned } from '../../utils/commission'
import type { CreateCommissionerRentalInput, rentalQuoteQuerySchema } from '../../utils/rental-validation'
import type { z } from 'zod'
import { canTransitionRentalStatus } from '../../utils/rental-status'
import { isRentalCode, toShopRental } from '../../utils/rental'
import { isUuid } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { insertExpense, listRecordedCommissionExpenses, updateExpenseByUuid, voidCommissionExpenses } from '../repositories/expense.repository'
import { calendarDateInZone } from '../../utils/datetime'
import { rentalPeriodDays } from '../../utils/rental-window'
import { findLinkedCommissionerUuid } from '../repositories/customer-commissioner.repository'
import { findProductByUuid, listBookableProducts } from '../repositories/product.repository'
import { findProfileKeyByUuid } from '../repositories/profile.repository'
import {
  deleteRentalById,
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  insertRentalItem,
  insertRentalRequest,
  insertRentalStatusHistory,
  listCommissionerRentals,
  updateRentalCommission,
  updateRentalStatus,
} from '../repositories/rental.repository'
import { ensureBookingCustomer } from './booking-customer'
import { buildQuote } from './rental.service'

type Client = SupabaseClient<Database>
type QuoteInput = z.infer<typeof rentalQuoteQuerySchema>

function personName(person: { firstName?: string, lastName?: string, first_name?: string, last_name?: string }) {
  const name = `${person.firstName || person.first_name || ''} ${person.lastName || person.last_name || ''}`.trim()
  return name || 'Commissioner'
}

export async function reconcileCommissionExpense(
  client: Client,
  rental: {
    id: number
    code: string
    status: string
    commissioner: { firstName?: string, lastName?: string, first_name?: string, last_name?: string } | null | undefined
    commissionAmount: number
    productName: string
    days: number
    quantity: number
  },
) {
  if (!isCommissionEarned(rental.status) || !rental.commissioner || rental.commissionAmount <= 0) {
    await voidCommissionExpenses(client, rental.id)
    return null
  }

  const recorded = await listRecordedCommissionExpenses(client, rental.id)
  const collected = recorded.filter(row => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount), 0)
  const [keep, ...extra] = recorded.filter(row => row.status === 'pending')
  const target = commissionStillToRecord(rental.commissionAmount, collected)

  for (const row of extra) {
    await updateExpenseByUuid(client, row.uuid, { status: 'void' })
  }

  if (target <= 0) {
    if (keep) {
      await updateExpenseByUuid(client, keep.uuid, { status: 'void' })
    }
    return null
  }

  const description = `${rental.productName} · ${rental.days} day${rental.days === 1 ? '' : 's'} × ${rental.quantity}${collected > 0 ? ' · balance after collected' : ''}`
  if (keep) {
    if (Number(keep.amount) !== target) {
      await updateExpenseByUuid(client, keep.uuid, {
        amount: target,
        description,
        vendor: personName(rental.commissioner),
      })
    }
    return keep.uuid
  }

  const created = await insertExpense(client, {
    name: `Commission · ${rental.code}`,
    category: 'commission',
    description,
    amount: target,
    vendor: personName(rental.commissioner),
    reference: rental.code,
    status: 'pending',
    notes: 'Commission earned on an approved booking. Mark it collected when the commissioner is paid.',
    incurred_on: calendarDateInZone(),
    rental_id: rental.id,
  })
  return created.uuid
}

export async function assignedCommission(
  client: Client,
  commissionerUuid: string,
  window: { productUuid: string, startsOn: string, endsOn: string, quantity: number },
) {
  const commissioner = await findProfileKeyByUuid(client, commissionerUuid)
  if (!commissioner || commissioner.role !== 'commissioner') {
    throw new AppError('Choose a commissioner.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const product = await findProductByUuid(client, window.productUuid)
  const commissionPerDay = Number(product?.commission_per_day ?? 0)
  return {
    commissioner,
    commissionPerDay,
    commissionAmount: commissionAmount(commissionPerDay, window.startsOn, window.endsOn, window.quantity),
  }
}

export async function applyLinkedCommissioner(
  client: Client,
  rental: { id: number, uuid: string, code: string, status: string },
  customerProfileId: number,
  booking: { productUuid: string, productName: string, startsOn: string, endsOn: string, quantity: number },
) {
  const commissionerUuid = await findLinkedCommissionerUuid(client, customerProfileId)
  if (!commissionerUuid) {
    return null
  }

  return syncAssignedCommission(client, rental, {
    commissionerUuid,
    productUuid: booking.productUuid,
    productName: booking.productName,
    startsOn: booking.startsOn,
    endsOn: booking.endsOn,
    days: rentalPeriodDays(booking.startsOn, booking.endsOn),
    quantity: booking.quantity,
  })
}

export async function syncAssignedCommission(
  client: Client,
  rental: { id: number, uuid: string, code: string, status?: string },
  input: {
    commissionerUuid?: string
    productUuid: string
    productName: string
    startsOn: string
    endsOn: string
    days: number
    quantity: number
  },
) {
  const assigned = input.commissionerUuid
    ? await assignedCommission(client, input.commissionerUuid, input)
    : null
  const amount = assigned?.commissionAmount ?? 0

  await updateRentalCommission(client, rental.uuid, {
    commissionerId: assigned?.commissioner.id ?? null,
    commissionPerDay: assigned?.commissionPerDay ?? 0,
    commissionAmount: amount,
  })
  await reconcileCommissionExpense(client, {
    id: rental.id,
    code: rental.code,
    status: rental.status ?? 'draft',
    commissioner: assigned?.commissioner ?? null,
    commissionAmount: amount,
    productName: input.productName,
    days: input.days,
    quantity: input.quantity,
  })

  return {
    commissionerUuid: assigned?.commissioner.uuid ?? null,
    commissionAmount: amount,
  }
}

async function loadOwnedRental(client: Client, profileId: number, identifier: string) {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null
  const identity = row ? await findRentalIdentity(client, row.uuid) : null

  if (!row || !identity || identity.commissioner_id !== profileId) {
    throw new AppError('Booking not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return { row, identity }
}

export async function listCommissionerEquipment(client: Client) {
  const rows = await listBookableProducts(client)
  return {
    items: rows.map(row => ({
      uuid: row.uuid,
      name: row.name,
      sku: row.sku,
      commissionPerDay: Number(row.commission_per_day ?? 0),
    })),
  }
}

export async function quoteCommissionerRental(client: Client, input: QuoteInput) {
  const quote = await buildQuote(client, input, { confirmedOnly: true })
  const product = quote.product.uuid ? await findProductByUuid(client, quote.product.uuid) : null
  const commissionPerDay = Number(product?.commission_per_day ?? 0)
  return {
    ...quote,
    commissionPerDay,
    commissionAmount: commissionAmount(commissionPerDay, quote.startsOn, quote.endsOn, quote.quantity),
  }
}

export async function createCommissionerRental(
  event: H3Event,
  client: Client,
  _commissioner: PublicProfile,
  profileId: number,
  input: CreateCommissionerRentalInput,
) {
  const quote = await quoteCommissionerRental(client, {
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

  const customerId = await ensureBookingCustomer(client, input)

  const created = await insertRentalRequest(client, {
    customer_id: customerId,
    commissioner_id: profileId,
    commission_per_day: quote.commissionPerDay,
    commission_amount: quote.commissionAmount,
    starts_on: quote.startsOn,
    ends_on: quote.endsOn,
    pickup_at: quote.pickupAt,
    return_at: quote.returnAt,
    status: 'pending',
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
      toStatus: 'pending',
      changedBy: profileId,
      note: 'Commissioner booked equipment for a client.',
    })
  }
  catch (error) {
    await deleteRentalById(client, created.id)
    throw error
  }

  const row = await findRentalByUuid(client, created.uuid)
  if (!row) {
    throw new AppError('Booking not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = toShopRental(row)
  await recordAudit(event, client, {
    action: 'rental.create',
    entity: 'rental_requests',
    entityId: rental.uuid,
    next: {
      code: rental.code,
      status: rental.status,
      source: 'commissioner',
      commissionAmount: quote.commissionAmount,
    },
  })

  return rental
}

export async function listOwnCommissionerRentals(client: Client, profileId: number) {
  const rows = await listCommissionerRentals(client, profileId)
  return {
    items: rows.map(row => toShopRental(row)),
    page: 1,
    pageSize: rows.length,
    total: rows.length,
  }
}

export async function getOwnCommissionerRental(client: Client, profileId: number, identifier: string) {
  const { row } = await loadOwnedRental(client, profileId, identifier)
  return toShopRental(row)
}

export async function cancelCommissionerRental(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
) {
  const { identity } = await loadOwnedRental(client, profileId, identifier)
  if (!canReleaseCommissionerBooking(identity.status) || !canTransitionRentalStatus(identity.status, 'cancelled')) {
    throw new AppError('That booking can no longer be cancelled.', 409, ERROR_CODES.CONFLICT)
  }

  await voidCommissionExpenses(client, identity.id)
  const row = await updateRentalStatus(client, identity.uuid, 'cancelled')
  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: identity.status,
    toStatus: 'cancelled',
    changedBy: profileId,
    note: 'Commissioner cancelled the booking.',
  })

  const rental = toShopRental(row)
  await recordAudit(event, client, {
    action: 'rental.cancel',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { status: identity.status },
    next: { status: 'cancelled', source: 'commissioner' },
  })

  return rental
}
